import { cinemaDirectory } from '../auditoriums/directory'
import { findAuditorium } from '../auditoriums/catalog'
import { createSeats } from '../auditoriums/geometry'
import { chainCinemas } from '../cinemas/chain-directory'
import { loadVieShowArchiveForCinema } from '../cinemas/vieshow-seat-archive'
import { publishedNamedHallsForCinema } from '../cinemas/other-chain-facts'
import {
  manualWatchDraftSchema,
  type ManualWatchDraft,
  type ManualWatchEntry,
} from './manual-history-schema'

export {
  manualWatchDraftSchema,
  manualWatchEntrySchema,
  type ManualWatchDraft,
  type ManualWatchEntry,
} from './manual-history-schema'

/** When editing an unversioned/text-only visit, never infer a legacy
 * 3D catalogue model solely from a matching display name. */
export function mustPreserveTextOnlyWatchEntry(
  entry: Pick<ManualWatchDraft, 'modelId' | 'modelVersion'>,
): boolean {
  return entry.modelId === null || entry.modelVersion === null
}

export interface WatchCinemaOption {
  slug: string
  name: string
  city: string
}

export interface WatchHallOption {
  name: string
  /** Only confirmed auditorium models may set modelId. */
  modelId: string | null
}

export const watchCinemaOptions: readonly WatchCinemaOption[] = [
  ...new Map(
    [
      ...chainCinemas.map(({ slug, name, city }) => ({ slug, name, city })),
      ...Array.from(new Set(cinemaDirectory.map((hall) => hall.cinemaSlug))).map((slug) => {
        const hall = cinemaDirectory.find((item) => item.cinemaSlug === slug)!
        return { slug, name: hall.cinemaName, city: hall.city }
      }),
    ].map((cinema) => [cinema.slug, cinema] as const),
  ).values(),
]

export function watchHallOptions(cinemaSlug: string): WatchHallOption[] {
  // Keep every published numeric auditorium, even when a single one gains a
  // sourced seating map. Do not reduce a major cinema to only its modelled hall.
  const published = publishedNamedHallsForCinema(cinemaSlug).map((hall) => ({
    name: /^\d+$/.test(hall.label) ? `${hall.label} 廳` : hall.label,
    modelId: null as string | null,
  }))
  const merged = new Map(published.map((hall) => [hall.name, hall]))
  for (const hall of cinemaDirectory.filter((item) => item.cinemaSlug === cinemaSlug)) {
    merged.set(hall.hallName, { name: hall.hallName, modelId: hall.modelId ?? null })
  }
  return [...merged.values()]
}

export function todayInTaipei(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Taipei',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(now)
  const get = (part: 'year' | 'month' | 'day') =>
    parts.find((entry) => entry.type === part)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

export function summariseWatchHistory(entries: readonly ManualWatchEntry[]) {
  return {
    viewings: entries.length,
    films: new Set(entries.map((entry) => entry.movieTitle)).size,
    cinemas: new Set(entries.map((entry) => entry.cinemaSlug ?? entry.cinemaName)).size,
    auditoriums: new Set(
      entries.map((entry) => `${entry.cinemaSlug ?? entry.cinemaName}/${entry.hallName}`),
    ).size,
    seats: new Set(
      entries
        .filter((entry) => entry.seatLabel)
        .map(
          (entry) => `${entry.cinemaSlug ?? entry.cinemaName}/${entry.hallName}/${entry.seatLabel}`,
        ),
    ).size,
  }
}

export function filterWatchHistory(
  entries: readonly ManualWatchEntry[],
  { query = '', cinema = 'all', year = 'all' } = {},
): ManualWatchEntry[] {
  const term = query.trim().toLocaleLowerCase()
  return entries
    .filter(
      (entry) =>
        (cinema === 'all' || (entry.cinemaSlug ?? entry.cinemaName) === cinema) &&
        (year === 'all' || entry.watchedOn.startsWith(year + '-')) &&
        (!term ||
          [entry.movieTitle, entry.cinemaName, entry.hallName, entry.seatLabel].some((value) =>
            value.toLocaleLowerCase().includes(term),
          )),
    )
    .sort(
      (a, b) => b.watchedOn.localeCompare(a.watchedOn) || b.createdAt.localeCompare(a.createdAt),
    )
}

/** Only valid, unchanged real auditorium layouts can reopen the exact seat. */
export function watchPreviewRoute(
  entry: ManualWatchEntry,
): { path: string; query: { seat: string } } | null {
  if (!entry.modelId || !entry.seatLabel || entry.modelVersion === null) return null
  const model = findAuditorium(entry.modelId)
  if (!model || model.modelVersion !== entry.modelVersion) return null
  const hall = cinemaDirectory.find(
    (item) =>
      item.modelId === entry.modelId &&
      item.cinemaSlug === entry.cinemaSlug &&
      item.hallName === entry.hallName,
  )
  if (!hall || !createSeats(model).some((seat) => seat.id === entry.seatLabel)) return null
  return { path: '/auditoriums/' + entry.modelId, query: { seat: entry.seatLabel } }
}

/**
 * Reopen a sourced Vie Show seat only after matching its currently archived
 * auditorium and actual seat label. Saved text alone is not a 3D model.
 * The old versioned auditorium previews remain handled by watchPreviewRoute.
 */
export async function watchVieShowPreviewRoute(
  entry: ManualWatchEntry,
): Promise<{ path: string; query: { seat: string; view: '3d' } } | null> {
  if (
    !entry.cinemaSlug?.startsWith('vieshow-') ||
    !entry.hallName ||
    !entry.seatLabel ||
    entry.modelId !== null ||
    entry.modelVersion !== null
  )
    return null

  const layouts = await loadVieShowArchiveForCinema(entry.cinemaSlug)
  const hallName = entry.hallName.trim()
  const numericHall = /^(?:第)?(\d+)\s*廳$/.exec(hallName)
  const matched = layouts.filter((layout) =>
    numericHall ? layout.hallNumber === Number(numericHall[1]) : layout.hallLabel === hallName,
  )
  if (
    matched.length !== 1 ||
    !matched[0]?.seatPositions.some(([label]) => label === entry.seatLabel)
  )
    return null

  return {
    path: `/cinemas/${entry.cinemaSlug}/halls/${matched[0].id}`,
    query: { seat: entry.seatLabel, view: '3d' },
  }
}

/** User text can always be saved without verifying an actual movie or screening. */
export function makeManualDraft(input: ManualWatchDraft): ManualWatchDraft {
  return manualWatchDraftSchema.parse(input)
}
