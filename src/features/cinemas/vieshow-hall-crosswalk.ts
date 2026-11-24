/**
 * Research-only hall-ID crosswalk candidates for Vie Show / MUVIE.
 *
 * A public 2026-05 corporate capacity row may use an ordinal or format code
 * different from the actual named hall in a 2026-11 operator seat preview.
 * NEVER infer a permanent physical hall identity from equal seat counts:
 * this function only partitions old unmatched published rows for follow-up.
 */
export type CrosswalkStatus =
  | 'unique-ordinary-capacity-candidate'
  | 'ambiguous-ordinary-capacity-candidate'
  | 'wheelchair-inclusive-capacity-candidate'
  | 'no-capacity-compatible-saved-grid'

export interface LegacyNumberedHall {
  hallNumber: number
  publishedSeatCount: number
}
export interface ObservedNamedHall {
  hallLabel: string
  hallNumber: number | null
  ordinarySeatCount: number
  wheelchairMarkers: number
}
export interface CrosswalkCandidate {
  observedHallLabel: string
  observedOrdinarySeatCount: number
  observedWheelchairMarkers: number
}
export interface CrosswalkAuditItem {
  oldPublishedHallNumber: number
  oldPublishedSeatCount: number
  status: CrosswalkStatus
  matches: CrosswalkCandidate[]
  permanentlyVerifiedHallIdentity: false
  createsNew3DModel: false
}

export function auditUnmatchedVieShowHallNumbers(
  missingOfficialNumbers: readonly number[],
  published: readonly LegacyNumberedHall[],
  observed: readonly ObservedNamedHall[],
): CrosswalkAuditItem[] {
  const officialByNumber = new Map<number, number>()
  for (const item of published) {
    if (
      !Number.isInteger(item.hallNumber) ||
      item.hallNumber < 1 ||
      !Number.isInteger(item.publishedSeatCount) ||
      item.publishedSeatCount < 1 ||
      officialByNumber.has(item.hallNumber)
    ) {
      throw new Error('Invalid or repeated historical operator hall-capacity record')
    }
    officialByNumber.set(item.hallNumber, item.publishedSeatCount)
  }
  const observedLabels = new Set<string>()
  for (const hall of observed) {
    if (
      !hall.hallLabel ||
      observedLabels.has(hall.hallLabel) ||
      !Number.isInteger(hall.ordinarySeatCount) ||
      hall.ordinarySeatCount < 1 ||
      !Number.isInteger(hall.wheelchairMarkers) ||
      hall.wheelchairMarkers < 0
    ) {
      throw new Error('Duplicate or invalid observed source-hall summary')
    }
    observedLabels.add(hall.hallLabel)
  }

  // A hall whose number already appears in the original published table is
  // NOT evidence that a *different* missing number denotes the same hall.
  const mismatchedIdentifiers = observed.filter(
    (hall) => hall.hallNumber === null || !officialByNumber.has(hall.hallNumber),
  )
  const uniqueMissing = new Set<number>()
  return missingOfficialNumbers.map((n) => {
    if (!officialByNumber.has(n) || uniqueMissing.has(n)) {
      throw new Error('Missing-number list disagrees with original official capacity table')
    }
    uniqueMissing.add(n)
    if (observed.some((hall) => hall.hallNumber === n)) {
      throw new Error('Source already includes the numbered hall marked as missing')
    }
    const publishedSeatCount = officialByNumber.get(n)!
    const candidate = (hall: ObservedNamedHall): CrosswalkCandidate => ({
      observedHallLabel: hall.hallLabel,
      observedOrdinarySeatCount: hall.ordinarySeatCount,
      observedWheelchairMarkers: hall.wheelchairMarkers,
    })
    const exact = mismatchedIdentifiers.filter(
      (hall) => hall.ordinarySeatCount === publishedSeatCount,
    )
    const wheelchairInclusive = mismatchedIdentifiers.filter(
      (hall) => hall.ordinarySeatCount + hall.wheelchairMarkers === publishedSeatCount,
    )
    const selected = exact.length ? exact : wheelchairInclusive
    const status: CrosswalkStatus = exact.length
      ? exact.length === 1
        ? 'unique-ordinary-capacity-candidate'
        : 'ambiguous-ordinary-capacity-candidate'
      : wheelchairInclusive.length
        ? 'wheelchair-inclusive-capacity-candidate'
        : 'no-capacity-compatible-saved-grid'
    return {
      oldPublishedHallNumber: n,
      oldPublishedSeatCount: publishedSeatCount,
      status,
      matches: selected.map(candidate),
      permanentlyVerifiedHallIdentity: false,
      createsNew3DModel: false,
    }
  })
}

export function summarizeUnmatchedHallAudits(
  rows: readonly CrosswalkAuditItem[],
): Record<CrosswalkStatus, number> {
  const counts: Record<CrosswalkStatus, number> = {
    'unique-ordinary-capacity-candidate': 0,
    'ambiguous-ordinary-capacity-candidate': 0,
    'wheelchair-inclusive-capacity-candidate': 0,
    'no-capacity-compatible-saved-grid': 0,
  }
  for (const row of rows) counts[row.status]++
  return counts
}
