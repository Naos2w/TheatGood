import raw from './data/miranew-observed-seats-2026-11-16.json'

export type ObservedSeatLabel = readonly [label: string, gridRow: number, gridColumn: number]

export type SeatLayoutCategory = 'standard' | 'imax' | 'royal'

export interface OfficialSeatLayoutReference {
  id: string
  cinemaSlug: 'miranew-taimall' | 'miranew-dazhi-royal'
  category: SeatLayoutCategory
  publishedHallLabel: string
  /** Missing: the public SeatView title gives a hall TYPE, but no permanent hall number. */
  physicalHallNumber: null
  snapshotSource: string
  observedAt: string
  repeatedInSample: number
  totalSeatLabels: number
  accessibleSeatLabels: number
  seatPositions: ObservedSeatLabel[]
}

const allowedCinemas = new Set(['miranew-taimall', 'miranew-dazhi-royal'])
const allowedCategories = new Set(['imax', 'standard', 'royal'])
const specialSeat = (label: string): boolean => /^(?:WW\d+|\d+W\d+|[A-Z]W\d+)$/.test(label)

/**
 * Only seat labels and grid positions visible in the cinema's PUBLIC booking
 * preview. Transient availability, pricing, accounts and booking IDs are not
 * imported as properties of seats. Booking URLs are temporary source pointers.
 */
export const miranewSeatReferences: readonly OfficialSeatLayoutReference[] = raw.layouts.map(
  (item) => {
    const url = new URL(item.snapshotSource)
    if (
      !allowedCinemas.has(item.cinemaSlug) ||
      !allowedCategories.has(item.category) ||
      item.physicalHallNumber !== null ||
      url.protocol !== 'https:' ||
      url.hostname !== 'www.miranewcinemas.com' ||
      url.pathname !== '/Movie/SeatView' ||
      !url.searchParams.has('SessionId')
    ) {
      throw new Error('Miranew seat layout has an invalid public source or hall identity')
    }

    const seatPositions: ObservedSeatLabel[] = item.seatPositions.map(([label, row, column]) => [
      String(label),
      Number(row),
      Number(column),
    ])
    if (
      seatPositions.length !== item.totalSeatLabels ||
      new Set(seatPositions.map(([label]) => label)).size !== seatPositions.length ||
      new Set(seatPositions.map(([, row, column]) => row + '/' + column)).size !==
        seatPositions.length ||
      seatPositions.some(([, row, column]) => row < 1 || column < 1 || row > 75 || column > 75) ||
      seatPositions.filter(([label]) => specialSeat(label)).length !== item.accessibleSeatLabels
    ) {
      throw new Error(
        'Miranew seat chart contains unverified duplicated/missing labels or placements',
      )
    }

    return {
      ...item,
      cinemaSlug: item.cinemaSlug as OfficialSeatLayoutReference['cinemaSlug'],
      category: item.category as SeatLayoutCategory,
      physicalHallNumber: null,
      seatPositions,
    }
  },
)

export function seatLayoutReferencesForCinema(cinemaSlug: string): OfficialSeatLayoutReference[] {
  return miranewSeatReferences.filter((reference) => reference.cinemaSlug === cinemaSlug)
}

export function seatLayoutReferenceById(id: string): OfficialSeatLayoutReference | undefined {
  return miranewSeatReferences.find((reference) => reference.id === id)
}

export function isReferenceSpecialSeat(label: string): boolean {
  return specialSeat(label)
}

export const miranewSeatCollectionSummary = {
  capturedOn: raw.checkedAt,
  sampledCharts: raw.sampledCharts,
  samplesFailed: raw.sampledFailed,
  distinctLayoutPatterns: miranewSeatReferences.length,
  // This is a total across non-identical patterns; not a sum of seats in cinemas.
  labelsAcrossPatterns: miranewSeatReferences.reduce(
    (total, item) => total + item.totalSeatLabels,
    0,
  ),
} as const
