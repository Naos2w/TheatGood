import type { PoolClient } from 'pg'
import type { PublicScreening } from '../api/screenings'

export const SCREENING_PROVIDER = 'moc-film-open-data'

// These are non-secret identifiers for the existing TheatGood Neon development branch.
// A different branch requires an explicit code review and change of these constants.
export const DEVELOPMENT_BRANCH_ID = 'br-super-mode-a1vmn1ny'
export const DEVELOPMENT_ENDPOINT_ID = 'ep-fancy-poetry-a1au7zkv'
const DEVELOPMENT_HOST = DEVELOPMENT_ENDPOINT_ID + '.ap-southeast-1.aws.neon.tech'

export interface SyncOutcome {
  observed: number
  addedMovies: number
  addedScreenings: number
  existingScreenings: number
  changedScreenings: number
}

/** Do not accept a production or pooled connection, even with a misleading env variable. */
export function requireDevelopmentSyncConfig(env: NodeJS.ProcessEnv): string {
  if (env.THEATGOOD_ALLOW_SCREENING_SYNC !== 'yes') {
    throw new Error('Real-screening writes require THEATGOOD_ALLOW_SCREENING_SYNC=yes')
  }
  if (env.NEON_DEV_BRANCH_ID !== DEVELOPMENT_BRANCH_ID) {
    throw new Error('Refusing sync: NEON_DEV_BRANCH_ID does not match the reviewed develop branch')
  }
  if (!env.DATABASE_URL) throw new Error('A develop-only DATABASE_URL is required')

  let url: URL
  try {
    url = new URL(env.DATABASE_URL)
  } catch {
    throw new Error('DATABASE_URL is invalid')
  }
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    url.hostname.toLowerCase() !== DEVELOPMENT_HOST
  ) {
    throw new Error(
      'Refusing sync: DATABASE_URL does not target the reviewed direct develop endpoint',
    )
  }
  return env.DATABASE_URL
}

export function validateScreeningSnapshot(items: readonly PublicScreening[]): void {
  if (!items.length || items.length > 5000) {
    throw new Error('Refusing to sync an empty or unexpectedly large culture feed')
  }
  const ids = new Set<string>()
  for (const item of items) {
    const time = new Date(item.startsAt)
    if (
      !item.id ||
      item.id.length > 240 ||
      ids.has(item.id) ||
      !item.sourceEventId ||
      !item.cinemaSlug ||
      !item.movieTitle.trim() ||
      item.movieTitle.length > 250 ||
      item.publishedHallLabel.length > 120 ||
      item.timeZone !== 'Asia/Taipei' ||
      Number.isNaN(time.getTime()) ||
      time.toISOString() !== item.startsAt ||
      !item.sourceUrl.startsWith('https://')
    ) {
      throw new Error('Culture feed contains an invalid or duplicate screening')
    }
    ids.add(item.id)
  }
}

/**
 * Persist only positively observed screenings. An event absent from a government
 * snapshot is NOT proof of cancellation. Old screenings remain available for
 * later viewing history and are never deleted or cancelled by this sync.
 *
 * The full import is a single transaction and serialised by a per-project lock.
 */
export async function persistScreeningSnapshot(
  client: PoolClient,
  items: readonly PublicScreening[],
  observedAt: Date,
): Promise<SyncOutcome> {
  validateScreeningSnapshot(items)
  if (Number.isNaN(observedAt.getTime())) throw new Error('Invalid observation time')

  await client.query('BEGIN')
  try {
    const { rows: branchRows } = await client.query<{
      branch_id: string | null
      endpoint_id: string | null
    }>(
      "SELECT current_setting('neon.branch_id', true) AS branch_id, " +
        "current_setting('neon.endpoint_id', true) AS endpoint_id",
    )
    if (
      branchRows[0]?.branch_id !== DEVELOPMENT_BRANCH_ID ||
      branchRows[0]?.endpoint_id !== DEVELOPMENT_ENDPOINT_ID
    ) {
      throw new Error('Refusing sync: connected PostgreSQL branch is not develop')
    }

    await client.query("SET LOCAL statement_timeout = '15s'")
    await client.query('SELECT pg_advisory_xact_lock(2026, 1116)')

    const cinemaSlugs = [...new Set(items.map((item) => item.cinemaSlug))]
    const hallSlugs = [
      ...new Set(items.flatMap((item) => (item.auditoriumSlug ? [item.auditoriumSlug] : []))),
    ]
    const titles = [...new Set(items.map((item) => item.movieTitle))]
    const sourceKeys = items.map((item) => item.id)

    const { rows: cinemaRows } = await client.query<{ id: string; slug: string }>(
      'SELECT id, slug FROM cinemas WHERE slug = ANY($1::text[])',
      [cinemaSlugs],
    )
    const cinemaIds = new Map(cinemaRows.map((row) => [row.slug, row.id]))
    if (cinemaSlugs.some((slug) => !cinemaIds.has(slug))) {
      throw new Error('Source references an unseeded cinema; seed the verified directory first')
    }

    const { rows: hallRows } = await client.query<{
      id: string
      slug: string
      cinema_slug: string
    }>(
      'SELECT a.id, a.slug, c.slug AS cinema_slug FROM auditoriums a ' +
        'JOIN cinemas c ON c.id = a.cinema_id WHERE a.slug = ANY($1::text[])',
      [hallSlugs],
    )
    const hallIds = new Map(hallRows.map((row) => [row.cinema_slug + '/' + row.slug, row.id]))
    if (
      items.some(
        (item) => item.auditoriumSlug && !hallIds.has(item.cinemaSlug + '/' + item.auditoriumSlug),
      )
    ) {
      throw new Error('Source hall is not verified within its cinema')
    }

    // Source titles are provisional, never treated as verified TMDB identities.
    const { rows: movieRows } = await client.query<{ id: string; title: string }>(
      'SELECT id, title FROM movies WHERE tmdb_id IS NULL ' +
        'AND title = ANY($1::text[]) ORDER BY created_at, id',
      [titles],
    )
    const movieIds = new Map<string, string>()
    for (const row of movieRows) if (!movieIds.has(row.title)) movieIds.set(row.title, row.id)

    const { rows: sourceRows } = await client.query<{
      source_key: string
      screening_id: string
    }>(
      'SELECT source_key, screening_id FROM screening_sources ' +
        'WHERE provider = $1 AND source_key = ANY($2::text[])',
      [SCREENING_PROVIDER, sourceKeys],
    )
    const existingScreeningIds = new Map(
      sourceRows.map((row) => [row.source_key, row.screening_id]),
    )
    const result: SyncOutcome = {
      observed: items.length,
      addedMovies: 0,
      addedScreenings: 0,
      existingScreenings: 0,
      changedScreenings: 0,
    }

    for (const item of items) {
      let movieId = movieIds.get(item.movieTitle)
      if (!movieId) {
        const { rows: created } = await client.query<{ id: string }>(
          'INSERT INTO movies (title) VALUES ($1) RETURNING id',
          [item.movieTitle],
        )
        if (!created[0]) throw new Error('Could not insert source movie')
        movieId = created[0].id
        movieIds.set(item.movieTitle, movieId)
        result.addedMovies++
      }

      const cinemaId = cinemaIds.get(item.cinemaSlug)
      if (!cinemaId) throw new Error('Unseeded cinema')
      const auditoriumId = item.auditoriumSlug
        ? (hallIds.get(item.cinemaSlug + '/' + item.auditoriumSlug) ?? null)
        : null
      const startsAt = new Date(item.startsAt)
      const raw = JSON.stringify({
        sourceEventId: item.sourceEventId,
        cinemaSlug: item.cinemaSlug,
        auditoriumSlug: item.auditoriumSlug,
        movieTitle: item.movieTitle,
      })

      const existingId = existingScreeningIds.get(item.id)
      if (existingId) {
        const update = await client.query(
          'UPDATE screenings SET movie_id = $2, cinema_id = $3, auditorium_id = $4, ' +
            "starts_at = $5, status = 'scheduled', updated_at = $6 WHERE id = $1 AND " +
            '(movie_id IS DISTINCT FROM $2 OR cinema_id IS DISTINCT FROM $3 OR ' +
            'auditorium_id IS DISTINCT FROM $4 OR starts_at IS DISTINCT FROM $5 ' +
            "OR status IS DISTINCT FROM 'scheduled')",
          [existingId, movieId, cinemaId, auditoriumId, startsAt, observedAt],
        )
        result.existingScreenings++
        if ((update.rowCount ?? 0) > 0) result.changedScreenings++

        await client.query(
          'UPDATE screening_sources SET source_url = $3, published_hall_label = $4, ' +
            'fetched_at = $5, raw = $6::jsonb WHERE provider = $1 AND source_key = $2',
          [SCREENING_PROVIDER, item.id, item.sourceUrl, item.publishedHallLabel, observedAt, raw],
        )
        continue
      }

      const { rows: inserted } = await client.query<{ id: string }>(
        'INSERT INTO screenings (movie_id, cinema_id, auditorium_id, starts_at, status) ' +
          "VALUES ($1, $2, $3, $4, 'scheduled') RETURNING id",
        [movieId, cinemaId, auditoriumId, startsAt],
      )
      if (!inserted[0]) throw new Error('Could not insert screening')

      await client.query(
        'INSERT INTO screening_sources ' +
          '(screening_id, provider, source_key, source_url, published_hall_label, fetched_at, raw) ' +
          'VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)',
        [
          inserted[0].id,
          SCREENING_PROVIDER,
          item.id,
          item.sourceUrl,
          item.publishedHallLabel,
          observedAt,
          raw,
        ],
      )
      result.addedScreenings++
    }

    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  }
}
