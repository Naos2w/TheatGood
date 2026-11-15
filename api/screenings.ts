/**
 * Taiwan Ministry of Culture / iCulture's "電影" open dataset (category 8).
 * Government Open Data Licence v1.0: https://data.gov.tw/dataset/6010
 *
 * Keep this Vercel API function self-contained (see /api/cinemas.ts and PR #13).
 * This endpoint reads public film screenings; it never writes to Neon or claims
 * ticket availability, and must never fabricate an auditorium or seat map.
 */
export const CULTURE_FILM_SOURCE =
  'https://cloud.culture.tw/frontsite/trans/SearchShowAction.do?method=doFindTypeJ&category=8'
const SOURCE_DATASET = 'https://data.gov.tw/dataset/6010'
const PROVIDER = 'moc-film-open-data'

export interface PublicScreening {
  id: string
  movieTitle: string
  cinemaSlug: string
  auditoriumSlug: string | null
  publishedHallLabel: string
  startsAt: string
  timeZone: 'Asia/Taipei'
  sourceUrl: string
  sourceEventId: string
}

interface KnownHall {
  cinemaSlug: string
  auditoriumSlug: string | null
}

/** Explicit venue-scoped matches only. Generic '1廳' is never a global alias. */
const hallLabels: [string, KnownHall][] = [
  ['高雄市電影館3樓', { cinemaSlug: 'kaohsiung-film-archive', auditoriumSlug: 'kfa-3f' }],
  ['高雄市電影館3F', { cinemaSlug: 'kaohsiung-film-archive', auditoriumSlug: 'kfa-3f' }],
  ['高雄市電影館3F放映廳', { cinemaSlug: 'kaohsiung-film-archive', auditoriumSlug: 'kfa-3f' }],
  ['高雄市電影館2F小型放映室', { cinemaSlug: 'kaohsiung-film-archive', auditoriumSlug: 'kfa-2f' }],
  [
    '內惟藝術中心 Reel ONE 1廳',
    { cinemaSlug: 'neiwei-art-center', auditoriumSlug: 'nwac-reel-one' },
  ],
  [
    '內惟藝術中心 Reel TWO 2廳',
    { cinemaSlug: 'neiwei-art-center', auditoriumSlug: 'nwac-reel-two' },
  ],
]
const canonical = (label: string): string =>
  label
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[\s\p{P}\p{S}]/gu, '')
const knownHalls = new Map(hallLabels.map(([label, known]) => [canonical(label), known]))

/** Unspecified hall remains null; an unassigned cultural event is not a cinema screening. */
function matchKnownVenue(label: string, title: string): KnownHall | undefined {
  const name = canonical(label)
  const hall = knownHalls.get(name)
  if (hall) return hall

  // Require a named film event from this operator, not generic VR/exhibition listings.
  if (!/^(?:\d{1,2}月)?高雄市電影館\s*[｜|：:]/u.test(title)) return undefined
  if (name === canonical('高雄市電影館')) {
    return { cinemaSlug: 'kaohsiung-film-archive', auditoriumSlug: null }
  }
  if (name === canonical('內惟藝術中心')) {
    return { cinemaSlug: 'neiwei-art-center', auditoriumSlug: null }
  }
  return undefined
}

/** Culture feed dates are local Taiwan wall-clock values, without UTC offsets. */
function taipeiDateTime(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const match = /^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(value.trim())
  if (!match) return undefined
  const localTime = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}`
  const utcTime = new Date(`${localTime}+08:00`)
  if (Number.isNaN(utcTime.getTime())) return undefined
  // Reject impossible calendar days and invalid clocks rather than auto-normalising.
  if (new Date(utcTime.getTime() + 8 * 3600_000).toISOString().slice(0, 19) !== localTime) {
    return undefined
  }
  return utcTime.toISOString()
}

function publicUrl(value: unknown): string {
  if (typeof value !== 'string') return SOURCE_DATASET
  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url.href : SOURCE_DATASET
  } catch {
    return SOURCE_DATASET
  }
}

/** One event UID can have several dated screenings, even in different halls. */
export function normaliseCultureScreenings(payload: unknown): PublicScreening[] {
  if (!Array.isArray(payload)) throw new Error('invalid_culture_feed')
  const unique = new Map<string, PublicScreening>()
  for (const rawActivity of payload) {
    if (!rawActivity || typeof rawActivity !== 'object') continue
    const event = rawActivity as Record<string, unknown>
    if (event.category !== '8' || typeof event.UID !== 'string' || !event.UID.trim()) continue
    if (typeof event.title !== 'string' || !event.title.trim() || !Array.isArray(event.showInfo)) {
      continue
    }

    const title = event.title.trim()
    const movieTitle = title.replace(/^(?:\d{1,2}月)?高雄市電影館\s*[｜|：:]\s*/u, '').trim()
    const sourceUrl = publicUrl(event.sourceWebPromote)
    for (const rawShow of event.showInfo) {
      if (!rawShow || typeof rawShow !== 'object') continue
      const show = rawShow as Record<string, unknown>
      if (typeof show.locationName !== 'string') continue
      const known = matchKnownVenue(show.locationName, title)
      const startsAt = taipeiDateTime(show.time)
      if (!known || !startsAt) continue

      const id = `${event.UID}:${known.cinemaSlug}:${known.auditoriumSlug ?? 'unknown'}:${startsAt}`
      if (!unique.has(id)) {
        unique.set(id, {
          id,
          movieTitle: movieTitle || title,
          cinemaSlug: known.cinemaSlug,
          auditoriumSlug: known.auditoriumSlug,
          publishedHallLabel: show.locationName.trim(),
          startsAt,
          timeZone: 'Asia/Taipei',
          sourceUrl,
          sourceEventId: event.UID,
        })
      }
    }
  }
  return [...unique.values()].sort(
    (a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id),
  )
}

export async function GET(): Promise<Response> {
  try {
    const result = await fetch(CULTURE_FILM_SOURCE, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    })
    if (!result.ok) return Response.json({ error: 'showtime_source_unavailable' }, { status: 503 })

    const payload = await result.json()
    const screenings = normaliseCultureScreenings(payload)
    return Response.json(
      {
        screenings,
        fetchedAt: new Date().toISOString(),
        provider: PROVIDER,
        datasetUrl: SOURCE_DATASET,
        attribution: '資料來源：文化部藝文機構電影欣賞節目表（政府資料開放授權條款第 1 版）',
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=60, s-maxage=900, stale-while-revalidate=3600',
        },
      },
    )
  } catch (error) {
    console.error('Culture film feed unavailable:', error instanceof Error ? error.name : 'unknown')
    return Response.json({ error: 'showtime_source_unavailable' }, { status: 503 })
  }
}
