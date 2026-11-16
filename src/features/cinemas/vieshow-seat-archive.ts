import manifest from './data/vieshow-coverage-2026-11-16.json'
import { publishedVieshowHalls } from './vieshow-halls'

export type ArchiveSeatPosition = readonly [label: string, row: number, column: number]
export type ArchiveWheelchairPosition = readonly [row: number, column: number]
export type ArchiveCountComparison =
  'exact' | 'wheelchair-markers-match' | 'different' | 'not-published'

export interface VieShowArchivedLayout {
  id: string
  hallLabel: string
  hallNumber: number | null
  cinemaCode: number
  snapshotSource: string
  observedAt: string
  publishedSeatCount: number | null
  countComparison: ArchiveCountComparison
  ordinarySeatCount: number
  wheelchairMarkers: number
  gridRows: number
  gridColumns: number
  seatPositions: ArchiveSeatPosition[]
  wheelchairPositions: ArchiveWheelchairPosition[]
}

export interface VieShowVenueSnapshot {
  schemaVersion: number
  venueSlug: string
  observedAt: string
  sourceType: string
  caveat: string
  layouts: VieShowArchivedLayout[]
}

type HallFact = (typeof manifest.venues)[number]['layoutFacts'][number]

const published = new Map(
  publishedVieshowHalls.map((hall) => [
    `${hall.cinemaSlug}|${hall.hallNumber}`,
    hall.publishedSeatCount,
  ]),
)

/**
 * Import each venue independently. Browsing a cinema must not eagerly load
 * 21 other cinemas' full seating grids into the initial route bundle.
 */
const archiveModules = import.meta.glob<VieShowVenueSnapshot>(
  './data/vieshow-snapshots-2026-11-16/*.json',
  { import: 'default' },
)
const cache = new Map<string, Promise<readonly VieShowArchivedLayout[]>>()

export const vieShowArchiveSummary = manifest.totals
export const vieShowArchiveCheckedAt = manifest.checkedAt

export function vieShowCoverageForCinema(cinemaSlug: string) {
  return manifest.venues.find((item) => item.venueSlug === cinemaSlug)
}

export function vieShowArchivedHallFact(
  cinemaSlug: string,
  hallLabel: string,
): HallFact | undefined {
  const venue = vieShowCoverageForCinema(cinemaSlug)
  if (!venue) return undefined
  const hallNumber = /^\d+$/.test(hallLabel) ? Number(hallLabel) : null
  return venue.layoutFacts.find((item) =>
    hallNumber !== null
      ? item.hallNumber === hallNumber
      : item.hallLabel.replace(/\s+/g, '') === hallLabel.replace(/\s+/g, ''),
  )
}

export function validateVieShowVenueSnapshot(
  input: VieShowVenueSnapshot,
  expectedSlug: string,
): void {
  const coverage = vieShowCoverageForCinema(expectedSlug)
  if (
    !coverage ||
    input.schemaVersion !== 2 ||
    input.venueSlug !== expectedSlug ||
    input.sourceType !== 'Vie Show public SessionSeats.aspx, read-only' ||
    input.layouts.length !== coverage.observedLabels
  ) {
    throw new Error('The Vie Show snapshot and venue coverage manifest disagree')
  }
  const hallIds = new Set<string>()
  for (const layout of input.layouts) {
    const source = new URL(layout.snapshotSource)
    const publishedSeatCount =
      layout.hallNumber === null
        ? null
        : (published.get(`${expectedSlug}|${layout.hallNumber}`) ?? null)
    const comparison: ArchiveCountComparison =
      publishedSeatCount === null
        ? 'not-published'
        : layout.ordinarySeatCount === publishedSeatCount
          ? 'exact'
          : layout.ordinarySeatCount + layout.wheelchairMarkers === publishedSeatCount
            ? 'wheelchair-markers-match'
            : 'different'
    if (
      !layout.id.startsWith(expectedSlug + '-') ||
      !layout.hallLabel ||
      hallIds.has(layout.id) ||
      (layout.hallNumber !== null &&
        (!Number.isInteger(layout.hallNumber) || layout.hallNumber < 1)) ||
      !Number.isInteger(layout.cinemaCode) ||
      layout.cinemaCode < 1 ||
      source.protocol !== 'https:' ||
      source.hostname !== 'sales.vscinemas.com.tw' ||
      source.pathname !== '/VoucherTicketing/SessionSeats.aspx' ||
      Number(source.searchParams.get('CinemaCode')) !== layout.cinemaCode ||
      !/^\d+$/.test(source.searchParams.get('txtSessionId') ?? '') ||
      layout.publishedSeatCount !== publishedSeatCount ||
      layout.countComparison !== comparison ||
      layout.ordinarySeatCount !== layout.seatPositions.length ||
      layout.wheelchairMarkers !== layout.wheelchairPositions.length ||
      !Number.isInteger(layout.gridRows) ||
      !Number.isInteger(layout.gridColumns) ||
      layout.gridRows < 1 ||
      layout.gridColumns < 1 ||
      layout.gridRows > 150 ||
      layout.gridColumns > 150
    ) {
      throw new Error('Vie Show seating snapshot has invalid source, hall or capacity metadata')
    }
    hallIds.add(layout.id)

    const labels = new Set<string>()
    const occupied = new Set<string>()
    for (const [label, row, column] of layout.seatPositions) {
      const cell = `${row}/${column}`
      if (
        !/^(?=.*\d)[A-Z0-9-]{2,9}$/i.test(label) ||
        labels.has(label) ||
        occupied.has(cell) ||
        !Number.isInteger(row) ||
        !Number.isInteger(column) ||
        row < 1 ||
        column < 1 ||
        row > layout.gridRows ||
        column > layout.gridColumns
      ) {
        throw new Error('Invalid or overlapping seat label in public seating snapshot')
      }
      labels.add(label)
      occupied.add(cell)
    }
    if (!labels.size) throw new Error('Empty Vie Show seating snapshot')
    for (const [row, column] of layout.wheelchairPositions) {
      const cell = `${row}/${column}`
      if (
        !Number.isInteger(row) ||
        !Number.isInteger(column) ||
        row < 1 ||
        column < 1 ||
        row > layout.gridRows ||
        column > layout.gridColumns ||
        occupied.has(cell)
      ) {
        throw new Error('Invalid wheelchair marker in public seating snapshot')
      }
      occupied.add(cell)
    }
  }
}

export function loadVieShowArchiveForCinema(
  cinemaSlug: string,
): Promise<readonly VieShowArchivedLayout[]> {
  if (!vieShowCoverageForCinema(cinemaSlug)) return Promise.resolve([])
  const existing = cache.get(cinemaSlug)
  if (existing) return existing
  const path = `./data/vieshow-snapshots-2026-11-16/${cinemaSlug}.json`
  const load = archiveModules[path]
  if (!load) return Promise.reject(new Error('Missing archived Vie Show seating data'))
  const pending = load().then((snapshot) => {
    validateVieShowVenueSnapshot(snapshot, cinemaSlug)
    return snapshot.layouts
  })
  cache.set(cinemaSlug, pending)
  pending.catch(() => cache.delete(cinemaSlug))
  return pending
}
