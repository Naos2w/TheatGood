/** Coordinates use metres: Y is up; the screen faces +Z at z=0. */
export interface ScreenDefinition {
  width: number
  height: number
  centerX: number
  bottomY: number
  z: number
}

export type DataConfidence = 'measured' | 'partial' | 'estimated'

export interface AuditoriumRow {
  label: string
  numbers: number[]
  z: number
  elevation: number
  /** Zero-based seat indexes after which an aisle appears. */
  aislesAfter: number[]
}

export interface AuditoriumDefinition {
  id: string
  name: string
  cinemaName: string
  format: string
  description: string
  confidence: DataConfidence
  sources: string[]
  screen: ScreenDefinition
  seatWidth: number
  seatSpacing: number
  aisleWidth: number
  eyeHeight: number
  rows: AuditoriumRow[]
}

export interface AuditoriumSeat {
  id: string
  row: string
  number: number
  x: number
  z: number
  elevation: number
  eyeY: number
}

export interface Sightline {
  distance: number
  horizontalAngle: number
  verticalAngle: number
  horizontalOffset: number
}

export function createSeats(auditorium: AuditoriumDefinition): AuditoriumSeat[] {
  const seats: AuditoriumSeat[] = []

  for (const row of auditorium.rows) {
    const gapWidth = row.aislesAfter.length * auditorium.aisleWidth
    const totalWidth = (row.numbers.length - 1) * auditorium.seatSpacing + gapWidth

    row.numbers.forEach((number, index) => {
      const precedingAisles = row.aislesAfter.filter((after) => after < index).length
      const x =
        -totalWidth / 2 + index * auditorium.seatSpacing + precedingAisles * auditorium.aisleWidth

      seats.push({
        id: `${row.label}${String(number).padStart(2, '0')}`,
        row: row.label,
        number,
        x,
        z: row.z,
        elevation: row.elevation,
        eyeY: row.elevation + auditorium.eyeHeight,
      })
    })
  }

  return seats
}

/** Angles are in degrees; distance is the horizontal range to screen centre. */
export function calculateSightline(seat: AuditoriumSeat, screen: ScreenDefinition): Sightline {
  const forward = seat.z - screen.z
  if (forward <= 0 || screen.width <= 0 || screen.height <= 0) {
    throw new RangeError('The screen must be ahead of the seat and have positive dimensions')
  }

  const leftX = screen.centerX - screen.width / 2
  const rightX = screen.centerX + screen.width / 2
  const bottomY = screen.bottomY
  const topY = bottomY + screen.height
  const radiansToDegrees = 180 / Math.PI

  return {
    distance: Math.hypot(forward, seat.x - screen.centerX),
    horizontalAngle:
      (Math.atan2(rightX - seat.x, forward) - Math.atan2(leftX - seat.x, forward)) *
      radiansToDegrees,
    verticalAngle:
      (Math.atan2(topY - seat.eyeY, forward) - Math.atan2(bottomY - seat.eyeY, forward)) *
      radiansToDegrees,
    horizontalOffset: Math.atan2(screen.centerX - seat.x, forward) * radiansToDegrees,
  }
}
