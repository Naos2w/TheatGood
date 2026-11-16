import { findAuditorium } from '../auditoriums/catalog'
import {
  createSeats,
  type AuditoriumSeat,
  type AuditoriumDefinition,
} from '../auditoriums/geometry'
import { watchPreviewRoute, type ManualWatchEntry } from './manual-history'

export interface SeatFootprintGroup {
  key: string
  cinemaName: string
  cinemaSlug: string | null
  hallName: string
  visits: ManualWatchEntry[]
  /** Official model only, when a recorded seat matches its current version. */
  modelId: string | null
  model: AuditoriumDefinition | null
  modelSeats: AuditoriumSeat[]
  /** Counts visits, not unique seats; all keys are genuine current model seat IDs. */
  visitedSeatCounts: Record<string, number>
  /** Free-text labels and seats tied to older/unavailable versions remain readable. */
  textOnlySeats: { label: string; count: number }[]
}

export function groupWatchFootprints(entries: readonly ManualWatchEntry[]): SeatFootprintGroup[] {
  const groups = new Map<string, SeatFootprintGroup>()
  const sorted = [...entries].sort(
    (a, b) => b.watchedOn.localeCompare(a.watchedOn) || b.createdAt.localeCompare(a.createdAt),
  )

  for (const entry of sorted) {
    const key = JSON.stringify([entry.cinemaSlug ?? entry.cinemaName, entry.hallName])
    let group = groups.get(key)
    if (!group) {
      group = {
        key,
        cinemaName: entry.cinemaName,
        cinemaSlug: entry.cinemaSlug,
        hallName: entry.hallName,
        visits: [],
        modelId: null,
        model: null,
        modelSeats: [],
        visitedSeatCounts: {},
        textOnlySeats: [],
      }
      groups.set(key, group)
    }
    group.visits.push(entry)

    // The exact auditorium model and the saved version must still be valid.
    const route = watchPreviewRoute(entry)
    if (route && entry.modelId) {
      const model = findAuditorium(entry.modelId)
      if (model && (!group.modelId || group.modelId === model.id)) {
        group.modelId = model.id
        group.model = model
        if (!group.modelSeats.length) group.modelSeats = createSeats(model)
        group.visitedSeatCounts[entry.seatLabel] =
          (group.visitedSeatCounts[entry.seatLabel] ?? 0) + 1
        continue
      }
    }
    if (entry.seatLabel) {
      const existing = group.textOnlySeats.find((item) => item.label === entry.seatLabel)
      if (existing) existing.count++
      else group.textOnlySeats.push({ label: entry.seatLabel, count: 1 })
    }
  }

  return [...groups.values()]
}

export function footstepVisitsForSeat(
  group: SeatFootprintGroup,
  seatId: string,
): ManualWatchEntry[] {
  return group.visits.filter(
    (entry) =>
      entry.seatLabel === seatId &&
      watchPreviewRoute(entry)?.path === (group.modelId ? '/auditoriums/' + group.modelId : ''),
  )
}
