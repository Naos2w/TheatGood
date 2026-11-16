import type { PoolClient } from 'pg'
import { describe, expect, it, vi } from 'vitest'
import type { PublicScreening } from '../api/screenings'
import {
  DEVELOPMENT_BRANCH_ID,
  DEVELOPMENT_ENDPOINT_ID,
  persistScreeningSnapshot,
  requireDevelopmentSyncConfig,
  validateScreeningSnapshot,
} from './screenings-sync'

function sample(overrides: Partial<PublicScreening> = {}): PublicScreening {
  return {
    id: 'event-1:kaohsiung-film-archive:kfa-3f:2026-11-20T11:00:00.000Z',
    movieTitle: '雙面薇若妮卡',
    cinemaSlug: 'kaohsiung-film-archive',
    auditoriumSlug: 'kfa-3f',
    publishedHallLabel: '高雄市電影館3樓',
    startsAt: '2026-11-20T11:00:00.000Z',
    timeZone: 'Asia/Taipei',
    sourceUrl: 'https://kfa.kcg.gov.tw/tw/film',
    sourceEventId: 'event-1',
    ...overrides,
  }
}

type ScreeningState = {
  movieId: string
  cinemaId: string
  hallId: string | null
  startsAt: string
  status: string
}

function fakeDatabase(options: { branchId?: string; seeded?: boolean } = {}) {
  const statements: string[] = []
  const movies = new Map<string, string>()
  const screenings = new Map<string, ScreeningState>()
  const sources = new Map<string, string>()
  let nextId = 1

  const query = vi.fn(async (sql: string, values: unknown[] = []) => {
    statements.push(sql)
    const result = (rows: Record<string, unknown>[] = [], rowCount: number | null = 0) => ({
      rows,
      rowCount,
    })

    if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return result()
    if (sql.startsWith('SET LOCAL statement_timeout')) return result()
    if (sql.startsWith('SELECT pg_advisory_xact_lock')) return result()
    if (sql.startsWith('SELECT current_setting')) {
      return result(
        [
          {
            branch_id: options.branchId ?? DEVELOPMENT_BRANCH_ID,
            endpoint_id: DEVELOPMENT_ENDPOINT_ID,
          },
        ],
        1,
      )
    }
    if (sql.startsWith('SELECT id, slug FROM cinemas')) {
      if (options.seeded === false) return result()
      const known = [
        { id: 'cinema-kfa', slug: 'kaohsiung-film-archive' },
        { id: 'cinema-nwac', slug: 'neiwei-art-center' },
      ]
      return result(known.filter((entry) => (values[0] as string[]).includes(entry.slug)))
    }
    if (sql.startsWith('SELECT a.id, a.slug')) {
      const known = [
        { id: 'hall-kfa', slug: 'kfa-3f', cinema_slug: 'kaohsiung-film-archive' },
        { id: 'hall-nwac', slug: 'nwac-reel-two', cinema_slug: 'neiwei-art-center' },
      ]
      return result(known.filter((entry) => (values[0] as string[]).includes(entry.slug)))
    }
    if (sql.startsWith('SELECT id, title FROM movies')) {
      const titles = values[0] as string[]
      return result(
        [...movies.entries()]
          .filter(([title]) => titles.includes(title))
          .map(([title, id]) => ({ title, id })),
      )
    }
    if (sql.startsWith('SELECT source_key, screening_id FROM screening_sources')) {
      const sourceKeys = values[1] as string[]
      return result(
        [...sources.entries()]
          .filter(([key]) => sourceKeys.includes(key))
          .map(([source_key, screening_id]) => ({ source_key, screening_id })),
      )
    }
    if (sql.startsWith('INSERT INTO movies')) {
      const title = values[0] as string
      const id = 'movie-' + nextId++
      movies.set(title, id)
      return result([{ id }], 1)
    }
    if (sql.startsWith('INSERT INTO screenings')) {
      const id = 'screening-' + nextId++
      const [movieId, cinemaId, hallId, startsAt] = values as [string, string, string | null, Date]
      screenings.set(id, {
        movieId,
        cinemaId,
        hallId,
        startsAt: startsAt.toISOString(),
        status: 'scheduled',
      })
      return result([{ id }], 1)
    }
    if (sql.startsWith('INSERT INTO screening_sources')) {
      sources.set(values[2] as string, values[0] as string)
      return result([], 1)
    }
    if (sql.startsWith('UPDATE screening_sources')) return result([], 1)
    if (sql.startsWith('UPDATE screenings')) {
      const [id, movieId, cinemaId, hallId, startsAt] = values as [
        string,
        string,
        string,
        string | null,
        Date,
      ]
      const previous = screenings.get(id)
      if (!previous) throw new Error('missing screening in fake database')
      const time = startsAt.toISOString()
      const changed =
        previous.movieId !== movieId ||
        previous.cinemaId !== cinemaId ||
        previous.hallId !== hallId ||
        previous.startsAt !== time ||
        previous.status !== 'scheduled'
      if (changed) {
        screenings.set(id, { movieId, cinemaId, hallId, startsAt: time, status: 'scheduled' })
      }
      return result([], Number(changed))
    }
    throw new Error('Unexpected SQL in fake client: ' + sql)
  })

  return {
    client: { query } as unknown as PoolClient,
    statements,
    movies,
    screenings,
    sources,
  }
}

describe('development-only Ministry of Culture persistence', () => {
  const observedAt = new Date('2026-11-16T01:00:00.000Z')
  const devUrl =
    'postgresql://reader:REDACTED@ep-fancy-poetry-a1au7zkv.ap-southeast-1.aws.neon.tech/theatgood?sslmode=require'

  it('refuses any write without opt-in, exact branch and exact direct host', () => {
    const safe = {
      THEATGOOD_ALLOW_SCREENING_SYNC: 'yes',
      NEON_DEV_BRANCH_ID: DEVELOPMENT_BRANCH_ID,
      DATABASE_URL: devUrl,
    }
    expect(requireDevelopmentSyncConfig(safe)).toBe(devUrl)
    expect(() =>
      requireDevelopmentSyncConfig({ ...safe, THEATGOOD_ALLOW_SCREENING_SYNC: '' }),
    ).toThrow()
    expect(() => requireDevelopmentSyncConfig({ ...safe, NEON_DEV_BRANCH_ID: 'main' })).toThrow()
    expect(() =>
      requireDevelopmentSyncConfig({
        ...safe,
        DATABASE_URL: devUrl.replace('ep-fancy-poetry-a1au7zkv', 'ep-summer-waterfall-a13pklok'),
      }),
    ).toThrow()
    expect(() =>
      requireDevelopmentSyncConfig({
        ...safe,
        DATABASE_URL: devUrl.replace('.ap-southeast', '-pooler.ap-southeast'),
      }),
    ).toThrow()
  })

  it('validates source keys, dates, titles, and duplicate IDs before writing', () => {
    expect(() => validateScreeningSnapshot([])).toThrow()
    expect(() => validateScreeningSnapshot([sample(), sample()])).toThrow()
    expect(() => validateScreeningSnapshot([sample({ movieTitle: ' ' })])).toThrow()
    expect(() =>
      validateScreeningSnapshot([sample({ startsAt: '2026-02-30T11:00:00.000Z' })]),
    ).toThrow()
    expect(() =>
      validateScreeningSnapshot([sample({ sourceUrl: 'javascript:alert(1)' })]),
    ).toThrow()
    expect(() => validateScreeningSnapshot([sample({ auditoriumSlug: null })])).not.toThrow()
  })

  it('saves an observed screening and replays it without creating duplicates', async () => {
    const db = fakeDatabase()
    const first = await persistScreeningSnapshot(db.client, [sample()], observedAt)
    expect(first).toEqual({
      observed: 1,
      addedMovies: 1,
      addedScreenings: 1,
      existingScreenings: 0,
      changedScreenings: 0,
    })
    expect(db.sources.size).toBe(1)
    expect(db.screenings.size).toBe(1)

    const second = await persistScreeningSnapshot(db.client, [sample()], observedAt)
    expect(second).toMatchObject({
      addedMovies: 0,
      addedScreenings: 0,
      existingScreenings: 1,
      changedScreenings: 0,
    })
    expect(db.sources.size).toBe(1)
    expect(db.screenings.size).toBe(1)
    expect(db.statements.filter((statement) => statement === 'COMMIT')).toHaveLength(2)
  })

  it('updates the same sourced screening when its announced title is corrected', async () => {
    const db = fakeDatabase()
    await persistScreeningSnapshot(db.client, [sample()], observedAt)
    const corrected = await persistScreeningSnapshot(
      db.client,
      [sample({ movieTitle: '雙面薇若妮卡（修訂）' })],
      observedAt,
    )
    expect(corrected).toMatchObject({
      addedMovies: 1,
      existingScreenings: 1,
      changedScreenings: 1,
      addedScreenings: 0,
    })
    expect(db.screenings.size).toBe(1)
    expect(db.sources.size).toBe(1)
  })

  it('preserves earlier observations when they are absent from a later partial snapshot', async () => {
    const db = fakeDatabase()
    const second = sample({
      id: 'event-2:neiwei-art-center:nwac-reel-two:2026-11-21T11:00:00.000Z',
      sourceEventId: 'event-2',
      movieTitle: '沙央',
      cinemaSlug: 'neiwei-art-center',
      auditoriumSlug: 'nwac-reel-two',
      publishedHallLabel: '內惟藝術中心 Reel TWO 2廳',
      startsAt: '2026-11-21T11:00:00.000Z',
    })
    await persistScreeningSnapshot(db.client, [sample(), second], observedAt)
    await persistScreeningSnapshot(db.client, [second], observedAt)
    expect(db.screenings.size).toBe(2)
    expect(db.sources.size).toBe(2)
    expect(db.statements.some((sql) => /DELETE|SET status = 'cancelled'/i.test(sql))).toBe(false)
  })

  it('rolls back without inserts on a wrong actual Neon branch or missing verified seed', async () => {
    for (const options of [{ branchId: 'br-broad-breeze-a1tpuwa7' }, { seeded: false }]) {
      const db = fakeDatabase(options)
      await expect(persistScreeningSnapshot(db.client, [sample()], observedAt)).rejects.toThrow()
      expect(db.statements.at(-1)).toBe('ROLLBACK')
      expect(db.statements).not.toContain('COMMIT')
      expect(db.sources.size).toBe(0)
    }
  })

  it('rejects an auditorium not confirmed within its parent cinema', async () => {
    const db = fakeDatabase()
    await expect(
      persistScreeningSnapshot(
        db.client,
        [sample({ auditoriumSlug: 'nwac-reel-two' })],
        observedAt,
      ),
    ).rejects.toThrow('not verified within its cinema')
    expect(db.statements.at(-1)).toBe('ROLLBACK')
    expect(db.screenings.size).toBe(0)
  })
})
