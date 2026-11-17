import raw from './data/vieshow-hsinyi-public-seat-layouts-2026-11-16.json'
import { publishedVieshowHalls } from './vieshow-halls'

export type VieShowSeatPosition = readonly [label: string, row: number, column: number]
export type VieShowWheelchairPosition = readonly [row: number, column: number]

export interface VieShowSeatReference {
  id: string
  cinemaSlug: 'vieshow-taipei-hsinyi'
  physicalHallNumber: number
  publishedSeatCount: number
  snapshotSource: string
  sessionId: string
  observedAt: string
  gridRows: number
  gridColumns: number
  ordinarySeatCount: number
  wheelchairMarkers: number
  seatPositions: VieShowSeatPosition[]
  wheelchairPositions: VieShowWheelchairPosition[]
}

const venue = 'vieshow-taipei-hsinyi'
const seatIdPattern = /^([A-Z]{1,2})([0-9]{1,3})$/

/**
 * Facts only: the public seat-preview grid's seat labels and relative cells.
 * No ticket availability, price, booking data or inferred physical 3D geometry.
 */
export function validateVieShowSeatReference(item: VieShowSeatReference): void {
  const source = new URL(item.snapshotSource)
  const publishedHall = publishedVieshowHalls.find(
    (hall) => hall.cinemaSlug === venue && hall.hallNumber === item.physicalHallNumber,
  )
  if (
    item.cinemaSlug !== venue ||
    item.id !== `vieshow-taipei-hsinyi-${item.physicalHallNumber}` ||
    !publishedHall ||
    item.publishedSeatCount !== publishedHall.publishedSeatCount ||
    source.protocol !== 'https:' ||
    source.hostname !== 'sales.vscinemas.com.tw' ||
    source.pathname !== '/VoucherTicketing/SessionSeats.aspx' ||
    source.searchParams.get('CinemaCode') !== '1' ||
    source.searchParams.get('txtSessionId') !== item.sessionId ||
    !Number.isFinite(Date.parse(item.observedAt)) ||
    !Number.isInteger(item.gridRows) ||
    !Number.isInteger(item.gridColumns) ||
    item.gridRows < 1 ||
    item.gridRows > 75 ||
    item.gridColumns < 1 ||
    item.gridColumns > 75
  ) {
    throw new Error('Vie Show reference must have a verified hall, source and grid dimensions')
  }

  const ids = new Set<string>()
  const occupied = new Set<string>()
  for (const [label, row, column] of item.seatPositions) {
    const match = seatIdPattern.exec(label)
    const gridKey = `${row}/${column}`
    if (
      !match ||
      !Number.isInteger(row) ||
      !Number.isInteger(column) ||
      row < 1 ||
      row > item.gridRows ||
      column < 1 ||
      column > item.gridColumns ||
      ids.has(label) ||
      occupied.has(gridKey)
    ) {
      throw new Error('Invalid or duplicate Vie Show seat label or grid cell')
    }
    ids.add(label)
    occupied.add(gridKey)
  }
  for (const [row, column] of item.wheelchairPositions) {
    const gridKey = `${row}/${column}`
    if (
      !Number.isInteger(row) ||
      !Number.isInteger(column) ||
      row < 1 ||
      row > item.gridRows ||
      column < 1 ||
      column > item.gridColumns ||
      occupied.has(gridKey)
    ) {
      throw new Error('Invalid, duplicate or overlapping wheelchair marker')
    }
    occupied.add(gridKey)
  }
  if (
    item.ordinarySeatCount !== ids.size ||
    item.ordinarySeatCount !== item.publishedSeatCount ||
    item.wheelchairMarkers !== item.wheelchairPositions.length
  ) {
    throw new Error('Vie Show seat reference differs from official published capacity')
  }
}

if (
  raw.schemaVersion !== 1 ||
  raw.venueSlug !== venue ||
  raw.sourceType !== 'public-booking-session-seat-preview'
) {
  throw new Error('Unexpected Vie Show source snapshot format')
}

export const vieshowSeatReferences: readonly VieShowSeatReference[] = raw.layouts
  .map((layout): VieShowSeatReference => {
    const item: VieShowSeatReference = {
      ...layout,
      cinemaSlug: venue,
      seatPositions: layout.seatPositions.map(([label, row, column]) => [
        String(label),
        Number(row),
        Number(column),
      ]),
      wheelchairPositions: layout.wheelchairPositions.map(([row, column]) => [
        Number(row),
        Number(column),
      ]),
    }
    validateVieShowSeatReference(item)
    return item
  })
  .sort((a, b) => a.physicalHallNumber - b.physicalHallNumber)

if (
  new Set(vieshowSeatReferences.map((item) => item.physicalHallNumber)).size !==
  vieshowSeatReferences.length
) {
  throw new Error('Duplicate physical hall in Vie Show source snapshot')
}

export function vieshowSeatReferencesForCinema(cinemaSlug: string): VieShowSeatReference[] {
  return cinemaSlug === venue ? [...vieshowSeatReferences] : []
}

export function vieshowSeatReferenceForHall(
  cinemaSlug: string,
  hallNumber: number,
): VieShowSeatReference | undefined {
  return vieshowSeatReferences.find(
    (reference) =>
      reference.cinemaSlug === cinemaSlug && reference.physicalHallNumber === hallNumber,
  )
}
