import raw from './data/in89-chiayi-coach2-public-chart-2026-02.json'
import type { VieShowArchivedLayout } from './vieshow-seat-archive'
import { publishedNamedHallsForCinema } from './other-chain-facts'

/** Dated public institutional hall chart; NOT an operator-confirmed November floor plan. */
export type In89PublicInstitutionLayout = Pick<
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
  cinemaSlug: 'in89-chiayi'
  provenance: 'public-school-2026-seat-diagram'
  sourcePublicationDates: readonly string[]
  sourceImages: readonly string[]
  operatorCurrentSource: string
  operatorAccessibilitySource: string
  verifiedCurrentPhysicalLayout: false
}

function assertSchoolSource(s: string, kind: 'image' | 'page'): void {
  const u = new URL(s)
  if (
    u.protocol !== 'https:' ||
    u.hostname !== 'www.cysh.cy.edu.tw' ||
    u.username ||
    u.password ||
    !u.pathname.startsWith(kind === 'image' ? '/var/file/8/1008/pictures/' : '/p/406-1008-') ||
    (kind === 'image' && !u.pathname.endsWith('.jpg')) ||
    (kind === 'page' && !u.pathname.endsWith('.php'))
  ) {
    throw new Error('Invalid institutional seating-chart provenance')
  }
}

export function validateIn89InstitutionalGrid(
  item: (typeof raw.layouts)[number],
): In89PublicInstitutionLayout {
  if (
    raw.schemaVersion !== 1 ||
    raw.sourceType !== 'dated-public-school-event-seating-chart' ||
    raw.layouts.length !== 1 ||
    item.id !== 'in89-chiayi-coach2' ||
    item.cinemaSlug !== 'in89-chiayi' ||
    item.hallNumber !== 2 ||
    item.hallLabel !== 'COACH 第2廳' ||
    item.officialHallAlias !== 'C2' ||
    item.provenance !== 'public-school-2026-seat-diagram' ||
    item.estimatedCurrentLayoutUnchanged !== false ||
    item.publishedSeatCount !== 95 ||
    item.operatorCurrentSeatPositions !== 95 ||
    item.operatorHistoricalOrdinarySeatCount !== 93 ||
    item.countComparison !== 'wheelchair-markers-match' ||
    item.ordinarySeatCount !== 93 ||
    item.wheelchairMarkers !== 2 ||
    item.gridRows !== 7 ||
    item.gridColumns !== 15 ||
    item.sourcePublicationDates.length !== 2 ||
    item.snapshotSources.length !== 2 ||
    item.publishedSourceImages.length !== 2 ||
    item.sourcePublicationDates[0] !== '2026-01-28' ||
    item.sourcePublicationDates[1] !== '2026-02-04' ||
    item.observedAt !== '2026-11-25' ||
    Object.keys(item).some((k) =>
      /^(choice|sold|available|availability|ticket|booking|customer|credential|password|payment|memberId|sessionId)/i.test(
        k,
      ),
    )
  ) {
    throw new Error('Unverified in89 dated COACH2 seating-grid metadata')
  }
  item.snapshotSources.forEach((s) => assertSchoolSource(s, 'page'))
  item.publishedSourceImages.forEach((s) => assertSchoolSource(s, 'image'))
  const operator = new URL(item.operatorCurrentSource)
  const accessibility = new URL(item.operatorAccessibilitySource)
  if (
    operator.origin !== 'https://www.in89cinemax.com' ||
    operator.pathname !== '/film_list.aspx' ||
    operator.searchParams.get('TheaterId') !== '17' ||
    accessibility.origin !== operator.origin ||
    accessibility.pathname !== '/theater_detail.aspx' ||
    accessibility.searchParams.get('TheaterId') !== '17' ||
    publishedNamedHallsForCinema(item.cinemaSlug).find((x) => x.label === 'C2')
      ?.publishedSeatCount !== 93
  ) {
    throw new Error('In89 Hall 2 historical and current capacity sources do not match')
  }
  const seatPositions = item.seatPositions.map(
    ([label, row, column]) => [String(label), Number(row), Number(column)] as const,
  )
  const wheelchairPositions = item.wheelchairPositions.map(
    ([row, column]) => [Number(row), Number(column)] as const,
  )
  if (
    item.seatPositions.some((s) => s.length !== 3) ||
    item.wheelchairPositions.some((s) => s.length !== 2) ||
    seatPositions.length !== 93 ||
    wheelchairPositions.length !== 2
  ) {
    throw new Error('Incomplete public in89 source grid')
  }
  const labelKeys = new Set<string>()
  const occupied = new Set<string>()
  for (const [label, row, column] of seatPositions) {
    if (
      !/^[A-G](?:[1-9]|1[0-4])$/.test(label) ||
      row !== label.charCodeAt(0) - 64 ||
      !Number.isInteger(row) ||
      !Number.isInteger(column) ||
      column < 1 ||
      column > item.gridColumns ||
      labelKeys.has(label) ||
      occupied.has(row + '/' + column)
    ) {
      throw new Error('Invalid or duplicated original in89 seat label/coordinate')
    }
    labelKeys.add(label)
    occupied.add(row + '/' + column)
  }
  for (const [row, column] of wheelchairPositions) {
    if (row !== 1 || ![2, 3].includes(column) || occupied.has(row + '/' + column)) {
      throw new Error('Invalid or colliding in89 wheelchair position')
    }
    occupied.add(row + '/' + column)
  }
  // Exactly the 2026-01-28 AND 2026-02-04 school diagrams:
  // front A row has two accessible positions; B–F are 14 seats each;
  // rear G row has 13 chairs. The one-unit blank centre aisle is retained.
  for (const row of 'ABCDEFG') {
    const found = seatPositions.filter(([id]) => id.startsWith(row))
    const count = row === 'A' ? 10 : row === 'G' ? 13 : 14
    if (found.length !== count) throw new Error('Missing dated chart row: ' + row)
    const expected = new Set(Array.from({ length: count }, (_, k) => row + (count - k)))
    if (
      new Set(found.map(([id]) => id)).size !== count ||
      found.some(([id]) => !expected.has(id))
    ) {
      throw new Error('Invalid dated school-chart row sequence')
    }
  }
  if (occupied.size !== 95) throw new Error('Wrong public-school-chart position count')
  return {
    id: item.id,
    cinemaSlug: 'in89-chiayi',
    hallNumber: item.hallNumber,
    hallLabel: item.hallLabel,
    snapshotSource: item.publishedSourceImages[0]!,
    observedAt: item.observedAt,
    publishedSeatCount: item.publishedSeatCount,
    countComparison: 'wheelchair-markers-match',
    ordinarySeatCount: item.ordinarySeatCount,
    wheelchairMarkers: item.wheelchairMarkers,
    gridRows: item.gridRows,
    gridColumns: item.gridColumns,
    seatPositions,
    wheelchairPositions,
    provenance: 'public-school-2026-seat-diagram',
    sourcePublicationDates: [...item.sourcePublicationDates],
    sourceImages: [...item.publishedSourceImages],
    operatorCurrentSource: item.operatorCurrentSource,
    operatorAccessibilitySource: item.operatorAccessibilitySource,
    verifiedCurrentPhysicalLayout: false,
  }
}

export const in89InstitutionSeatCharts: readonly In89PublicInstitutionLayout[] = raw.layouts.map(
  validateIn89InstitutionalGrid,
)

export function in89SeatChartsForCinema(cinemaSlug: string): In89PublicInstitutionLayout[] {
  return in89InstitutionSeatCharts.filter((x) => x.cinemaSlug === cinemaSlug)
}

export function in89HasPublishedFullGrid(cinemaSlug: string, label: string): boolean {
  return in89InstitutionSeatCharts.some(
    (x) => x.cinemaSlug === cinemaSlug && (label === 'C2' || label === '2'),
  )
}

export const in89PublicSeatSourceSummary = {
  sourceCheckedOn: raw.checkedAt,
  venueCount: new Set(in89InstitutionSeatCharts.map((x) => x.cinemaSlug)).size,
  layoutCount: in89InstitutionSeatCharts.length,
  ordinarySeats: in89InstitutionSeatCharts.reduce((n, x) => n + x.ordinarySeatCount, 0),
  wheelchairPositions: in89InstitutionSeatCharts.reduce((n, x) => n + x.wheelchairMarkers, 0),
  currentPhysicalGridReconfirmed: false,
} as const
