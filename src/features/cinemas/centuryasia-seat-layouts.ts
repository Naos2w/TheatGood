import raw from './data/centuryasia-public-grids-2026-11-24.json'
import type { VieShowArchivedLayout } from './vieshow-seat-archive'
import { publishedNamedHallsForCinema } from './other-chain-facts'

/** Public seat-ID and grid facts; unlike operator screen dimensions, these are observed. */
export type CenturyAsiaPublicLayout = Pick<
  VieShowArchivedLayout,
  | 'id'
  | 'hallLabel'
  | 'hallNumber'
  | 'snapshotSource'
  | 'observedAt'
  | 'publishedSeatCount'
  | 'countComparison'
  | 'ordinarySeatCount'
  | 'wheelchairMarkers'
  | 'gridRows'
  | 'gridColumns'
  | 'seatPositions'
  | 'wheelchairPositions'
> & {
  cinemaSlug: 'centuryasia-nangang' | 'centuryasia-yonghe'
  provenance: 'operator-public-SEAT-PREVIEW-read-only'
}

const sourceToSlug = {
  Nangang: 'centuryasia-nangang',
  Beyond: 'centuryasia-yonghe',
} as const

export function validateCenturyAsiaPublicLayout(
  item: (typeof raw.layouts)[number],
): CenturyAsiaPublicLayout {
  const url = new URL(item.snapshotSource)
  const request = new URL(item.sourceRequest)
  const sourceFields = request.pathname.split('/').slice(3)
  const sourceSlug = sourceToSlug[sourceFields[0] as keyof typeof sourceToSlug]
  const sourceHall = sourceFields[4]
  const published = publishedNamedHallsForCinema(item.cinemaSlug).find(
    (hall) => hall.label === String(item.hallNumber),
  )
  if (
    raw.schemaVersion !== 1 ||
    raw.sourceType !== 'Century Asia official public SEAT PREVIEW, read-only' ||
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    Object.keys(item).some((key) =>
      /^(choice|sold|available|availability|booking|ticket|customer|payment|password|memberId|sessionId)/i.test(
        key,
      ),
    ) ||
    url.hostname !== 'www.centuryasia.com.tw' ||
    url.pathname !== '/book.html' ||
    request.origin !== url.origin ||
    request.username ||
    request.password ||
    request.search ||
    request.hash ||
    !request.pathname.startsWith('/Movie/GetSeatView/') ||
    url.searchParams.get('sid') !== sourceFields[0] ||
    sourceFields.length !== 5 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(sourceFields[2] ?? '') ||
    !/^\d{2}-\d{2}$/.test(sourceFields[3] ?? '') ||
    !/^\d+$/.test(sourceHall ?? '') ||
    Number(sourceHall) !== item.hallNumber ||
    sourceSlug !== item.cinemaSlug ||
    item.id !== item.cinemaSlug + '-' + item.hallNumber ||
    item.hallLabel !== '第' + item.hallNumber + '廳' ||
    !Number.isFinite(Date.parse(item.observedAt)) ||
    item.provenance !== 'operator-public-SEAT-PREVIEW-read-only' ||
    !published ||
    published.publishedSeatCount !== item.publishedSeatCount ||
    item.countComparison === 'different' ||
    !Number.isInteger(item.gridRows) ||
    !Number.isInteger(item.gridColumns) ||
    item.gridRows < 1 ||
    item.gridRows > 120 ||
    item.gridColumns < 1 ||
    item.gridColumns > 160
  ) {
    throw new Error('Invalid CenturyAsia public screening provenance or hall identity')
  }
  if (
    item.seatPositions.some((p) => p.length !== 3) ||
    item.wheelchairPositions.some((p) => p.length !== 2)
  ) {
    throw new Error('Unexpected booking fields attached to public seat coordinates')
  }
  const seatPositions = item.seatPositions.map(
    ([label, row, column]) => [String(label), Number(row), Number(column)] as const,
  )
  const wheelchairPositions = item.wheelchairPositions.map(
    ([row, column]) => [Number(row), Number(column)] as const,
  )
  const ids = new Set<string>()
  const positions = new Set<string>()
  for (const [id, row, col] of seatPositions) {
    if (
      !/^\d{1,3}-\d{1,3}$/.test(id) ||
      Number(id.split('-')[0]) !== row ||
      !Number.isInteger(row) ||
      !Number.isInteger(col) ||
      row < 1 ||
      row > item.gridRows ||
      col < 1 ||
      col > item.gridColumns ||
      ids.has(id) ||
      positions.has(row + '/' + col)
    ) {
      throw new Error('Overlapping or fabricated numbered CenturyAsia seat')
    }
    ids.add(id)
    positions.add(row + '/' + col)
  }
  for (const [row, col] of wheelchairPositions) {
    if (
      !Number.isInteger(row) ||
      !Number.isInteger(col) ||
      row < 1 ||
      row > item.gridRows ||
      col < 1 ||
      col > item.gridColumns ||
      positions.has(row + '/' + col)
    ) {
      throw new Error('Invalid public wheelchair marker or overlapping seat')
    }
    positions.add(row + '/' + col)
  }
  if (
    seatPositions.length !== item.ordinarySeatCount ||
    wheelchairPositions.length !== item.wheelchairMarkers ||
    (seatPositions.length === published.publishedSeatCount
      ? item.countComparison !== 'exact'
      : seatPositions.length + wheelchairPositions.length !== published.publishedSeatCount ||
        item.countComparison !== 'wheelchair-markers-match')
  ) {
    throw new Error('Public seat grid does not reconcile with operator hall capacity')
  }
  return {
    id: item.id,
    cinemaSlug: sourceSlug,
    hallNumber: item.hallNumber,
    hallLabel: item.hallLabel,
    snapshotSource: item.snapshotSource,
    observedAt: item.observedAt,
    publishedSeatCount: item.publishedSeatCount,
    countComparison: item.countComparison as CenturyAsiaPublicLayout['countComparison'],
    ordinarySeatCount: item.ordinarySeatCount,
    wheelchairMarkers: item.wheelchairMarkers,
    gridRows: item.gridRows,
    gridColumns: item.gridColumns,
    seatPositions,
    wheelchairPositions,
    provenance: 'operator-public-SEAT-PREVIEW-read-only',
  }
}
const allIds = new Set<string>()
export const centuryasiaPublicSeatLayouts: readonly CenturyAsiaPublicLayout[] = raw.layouts.map(
  (item) => {
    const checked = validateCenturyAsiaPublicLayout(item)
    if (allIds.has(checked.id)) throw new Error('Duplicate CenturyAsia numbered source hall')
    allIds.add(checked.id)
    return checked
  },
)

export function centuryasiaSeatLayoutsForCinema(cinemaSlug: string): CenturyAsiaPublicLayout[] {
  return centuryasiaPublicSeatLayouts.filter((layout) => layout.cinemaSlug === cinemaSlug)
}

export function centuryasiaHasVerifiedHall(cinemaSlug: string, hallLabel: string): boolean {
  return centuryasiaPublicSeatLayouts.some(
    (layout) => layout.cinemaSlug === cinemaSlug && String(layout.hallNumber) === hallLabel,
  )
}

export const centuryasiaPublicSeatSummary = {
  observedAt: raw.checkedAt,
  verifiedHalls: centuryasiaPublicSeatLayouts.length,
  sourcedVenues: new Set(centuryasiaPublicSeatLayouts.map((x) => x.cinemaSlug)).size,
  normalSeats: centuryasiaPublicSeatLayouts.reduce((n, x) => n + x.ordinarySeatCount, 0),
  wheelchairPositions: centuryasiaPublicSeatLayouts.reduce((n, x) => n + x.wheelchairMarkers, 0),
}
