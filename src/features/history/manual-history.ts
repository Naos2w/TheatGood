import { z } from 'zod'
import { cinemaDirectory } from '../auditoriums/directory'
import { findAuditorium } from '../auditoriums/catalog'
import { createSeats } from '../auditoriums/geometry'
import { chainCinemas } from '../cinemas/chain-directory'
import { publishedNamedHallsForCinema } from '../cinemas/other-chain-facts'

/**
 * A user's own viewing memory, not an assertion that a film or session existed.
 * This is a browser-local prototype; cloud-authenticated history comes later.
 */
export const manualWatchDraftSchema = z.object({
  movieTitle: z.string().trim().min(1).max(250),
  watchedOn: z.iso.date(),
  cinemaSlug: z.string().max(120).nullable(),
  cinemaName: z.string().trim().min(1).max(200),
  hallName: z.string().trim().max(160),
  seatLabel: z.string().trim().max(20),
  modelId: z.string().max(120).nullable(),
  modelVersion: z.number().int().positive().nullable(),
  manualEntry: z.literal(true),
  screeningId: z.null(),
})

export const manualWatchEntrySchema = manualWatchDraftSchema.extend({
  id: z.string().uuid(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

export type ManualWatchDraft = z.infer<typeof manualWatchDraftSchema>
export type ManualWatchEntry = z.infer<typeof manualWatchEntrySchema>

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
  ...chainCinemas.map(({ slug, name, city }) => ({ slug, name, city })),
  ...Array.from(new Set(cinemaDirectory.map((hall) => hall.cinemaSlug))).map((slug) => {
    const hall = cinemaDirectory.find((item) => item.cinemaSlug === slug)!
    return { slug, name: hall.cinemaName, city: hall.city }
  }),
]

export function watchHallOptions(cinemaSlug: string): WatchHallOption[] {
  const officialHalls = cinemaDirectory.filter((hall) => hall.cinemaSlug === cinemaSlug)
  if (officialHalls.length) {
    return officialHalls.map((hall) => ({ name: hall.hallName, modelId: hall.modelId ?? null }))
  }
  return publishedNamedHallsForCinema(cinemaSlug).map((hall) => ({
    name: /^\d+$/.test(hall.label) ? `${hall.label} 廳` : hall.label,
    modelId: null,
  }))
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

/** User text can always be saved without verifying an actual movie or screening. */
export function makeManualDraft(input: ManualWatchDraft): ManualWatchDraft {
  return manualWatchDraftSchema.parse(input)
}
