/**
 * Source-evidence gate for future chain cinema seat-grid research.
 *
 * This never creates models, copies operator artwork or publishes member-only
 * seating information. It can only report whether a submitted, already
 * acquired grid is structurally ready for INDEPENDENT source review.
 */
import { chainCinemas, type ChainBrand } from './chain-directory'
import { publishedNamedHallsForCinema } from './other-chain-facts'

export type PendingGridBrand = Extract<
  ChainBrand,
  'ambassador' | 'in89' | 'broadway' | 'centuryasia' | 'skcinemas' | 'miramar'
>
export type ObservedSeatPosition = {
  label: string
  gridRow: number
  gridColumn: number
}
export interface OperatorSeatGridCandidate {
  brand: PendingGridBrand
  cinemaSlug: string
  hallLabel: string
  /** Exactly what the official source identifies, not a capacity-based mapping. */
  sourceCinemaSlug: string
  sourceHallLabel: string
  sourceUrl: string
  observedAt: string
  sourceMethod: 'public-operator-grid' | 'owner-authorised-operator-preview'
  hallIdentification:
    'same-official-screening-card' | 'official-numbered-seat-diagram' | 'capacity-cross-reference'
  /** True only when every observed seat position and aisle gap is present. */
  completeGrid: boolean
  seatPositions: ObservedSeatPosition[]
}

export type SeatGridAuditReason =
  | 'unknown-cinema-or-brand'
  | 'unapproved-source-host'
  | 'invalid-observation-date'
  | 'unsupported-source-method'
  | 'hall-identity-not-source-confirmed'
  | 'incomplete-grid'
  | 'implausible-seat-count'
  | 'duplicate-seat-label'
  | 'duplicate-seat-coordinate'
  | 'invalid-seat-position'
  | 'sensitive-booking-fields'

const officialHosts: Record<PendingGridBrand, readonly string[]> = {
  ambassador: ['www.ambassador.com.tw', 'shinefilm.ambassador.com.tw', 'booking.ambassador.com.tw'],
  in89: ['www.in89cinemax.com'],
  broadway: ['www.broadway-cineplex.com.tw'],
  centuryasia: ['www.centuryasia.com.tw', 'ticket.centuryasia.com.tw'],
  skcinemas: ['www.skcinemas.com'],
  miramar: ['www.miramarcinemas.tw'],
}

const prohibitedField =
  /^(?:sold|available|availability|ticket|booking|customer|credential|password|payment|sessionId|memberId)/i
const normaliseHallLabel = (s: string): string => s.replace(/\s+/g, '').toLocaleLowerCase('zh-TW')

export function auditOperatorSeatGridCandidate(candidate: OperatorSeatGridCandidate): {
  status: 'blocked' | 'candidate-needs-independent-review'
  reasons: SeatGridAuditReason[]
  cinemaSlug: string
  hallLabel: string
  seatPositionsCount: number
  publicationScope: 'private-research-only' | 'public-research-only'
  publishable: false
} {
  const reasons: SeatGridAuditReason[] = []
  const officialVenue = chainCinemas.find((item) => item.slug === candidate.cinemaSlug)
  if (
    !officialVenue ||
    officialVenue.brand !== candidate.brand ||
    !officialHosts[candidate.brand]
  ) {
    reasons.push('unknown-cinema-or-brand')
  }

  try {
    const url = new URL(candidate.sourceUrl)
    const sourceHost = url.hostname
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      !officialHosts[candidate.brand]?.includes(sourceHost)
    ) {
      reasons.push('unapproved-source-host')
    }
  } catch {
    reasons.push('unapproved-source-host')
  }

  if (
    !['public-operator-grid', 'owner-authorised-operator-preview'].includes(candidate.sourceMethod)
  )
    reasons.push('unsupported-source-method')

  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(candidate.observedAt) ||
    !Number.isFinite(Date.parse(candidate.observedAt))
  )
    reasons.push('invalid-observation-date')

  if (
    typeof candidate.hallLabel !== 'string' ||
    !candidate.hallLabel.trim() ||
    candidate.sourceCinemaSlug !== candidate.cinemaSlug ||
    typeof candidate.sourceHallLabel !== 'string' ||
    !candidate.sourceHallLabel.trim() ||
    normaliseHallLabel(candidate.sourceHallLabel) !== normaliseHallLabel(candidate.hallLabel) ||
    candidate.hallIdentification === 'capacity-cross-reference'
  )
    reasons.push('hall-identity-not-source-confirmed')

  if (!candidate.completeGrid) reasons.push('incomplete-grid')
  if (
    !Array.isArray(candidate.seatPositions) ||
    candidate.seatPositions.length < 10 ||
    candidate.seatPositions.length > 3000
  ) {
    reasons.push('implausible-seat-count')
  } else {
    const labels = new Set<string>()
    const coordinates = new Set<string>()
    for (const position of candidate.seatPositions) {
      if (
        !position ||
        typeof position.label !== 'string' ||
        !position.label.trim() ||
        position.label.length > 24 ||
        !Number.isInteger(position.gridRow) ||
        !Number.isInteger(position.gridColumn) ||
        position.gridRow < 1 ||
        position.gridRow > 250 ||
        position.gridColumn < 1 ||
        position.gridColumn > 250
      ) {
        if (!reasons.includes('invalid-seat-position')) reasons.push('invalid-seat-position')
        continue
      }
      const label = position.label.trim()
      const xy = position.gridRow + '/' + position.gridColumn
      if (labels.has(label) && !reasons.includes('duplicate-seat-label'))
        reasons.push('duplicate-seat-label')
      if (coordinates.has(xy) && !reasons.includes('duplicate-seat-coordinate'))
        reasons.push('duplicate-seat-coordinate')
      labels.add(label)
      coordinates.add(xy)
      if (
        Object.keys(position).some((name) => prohibitedField.test(name)) &&
        !reasons.includes('sensitive-booking-fields')
      ) {
        reasons.push('sensitive-booking-fields')
      }
    }
  }
  if (Object.keys(candidate).some((name) => prohibitedField.test(name))) {
    if (!reasons.includes('sensitive-booking-fields')) reasons.push('sensitive-booking-fields')
  }

  return {
    status: reasons.length ? 'blocked' : 'candidate-needs-independent-review',
    reasons,
    cinemaSlug: candidate.cinemaSlug,
    hallLabel: candidate.hallLabel,
    seatPositionsCount: Array.isArray(candidate.seatPositions) ? candidate.seatPositions.length : 0,
    publicationScope:
      candidate.sourceMethod === 'owner-authorised-operator-preview'
        ? 'private-research-only'
        : 'public-research-only',
    // Even structurally valid inputs still need source/version/rights review.
    publishable: false,
  }
}

/**
 * Based solely on the application's operator-source directory/capacity
 * snapshots. These are acquisition tasks, never newly verified physical halls.
 */
export interface PendingChainSeatResearchTask {
  brand: PendingGridBrand
  cinemaSlug: string
  venue: string
  hallLabel: string | null
  publishedSeatCount: number | null
  sourceUrl: string
  status: 'need-official-hall-census-and-grid' | 'capacity-only-needs-grid'
  seatGridVerified: false
}

export function pendingChainSeatSourceWorklist(): PendingChainSeatResearchTask[] {
  const brands: readonly PendingGridBrand[] = [
    'ambassador',
    'in89',
    'broadway',
    'centuryasia',
    'skcinemas',
    'miramar',
  ]
  return brands.flatMap((brand) =>
    chainCinemas
      .filter((cinema) => cinema.brand === brand)
      .flatMap<PendingChainSeatResearchTask>((cinema) => {
        const halls = publishedNamedHallsForCinema(cinema.slug)
        if (!halls.length) {
          return [
            {
              brand,
              cinemaSlug: cinema.slug,
              venue: cinema.name,
              hallLabel: null,
              publishedSeatCount: null,
              sourceUrl: cinema.sourceUrl,
              status: 'need-official-hall-census-and-grid' as const,
              seatGridVerified: false as const,
            },
          ]
        }
        return halls.map((hall) => ({
          brand,
          cinemaSlug: cinema.slug,
          venue: cinema.name,
          hallLabel: hall.label,
          publishedSeatCount: hall.publishedSeatCount,
          sourceUrl: hall.sourceUrl,
          status: 'capacity-only-needs-grid' as const,
          seatGridVerified: false as const,
        }))
      }),
  )
}
