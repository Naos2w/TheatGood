import type { AuditoriumSeat } from './geometry'

/** Move by physical X position, not numeric seat label (e.g. E02 -> E05). */
export function neighbouringSeat(
  seats: AuditoriumSeat[],
  selectedSeatId: string,
  direction: -1 | 1,
): AuditoriumSeat | undefined {
  const current = seats.find((seat) => seat.id === selectedSeatId)
  if (!current) return undefined
  const rowSeats = seats.filter((seat) => seat.row === current.row).sort((a, b) => a.x - b.x)
  const index = rowSeats.findIndex((seat) => seat.id === selectedSeatId)
  return rowSeats[index + direction]
}

/**
 * Move one observed row closer to / further from the screen while retaining
 * the nearest physical X position, even if seat numbers or aisles differ.
 * The screen is at the low-Z end of the auditorium coordinate system.
 * Skip absent rows; do not fabricate intervening seats.
 */
export function neighbouringRowSeat(
  seats: AuditoriumSeat[],
  selectedSeatId: string,
  direction: -1 | 1,
): AuditoriumSeat | undefined {
  const current = seats.find((seat) => seat.id === selectedSeatId)
  if (!current) return undefined
  const rows = [...new Set(seats.map((seat) => seat.z))].sort((a, b) => a - b)
  const index = rows.findIndex((z) => z === current.z)
  if (index === -1) return undefined
  const targetZ = rows[index + direction]
  if (targetZ === undefined) return undefined
  return seats
    .filter((seat) => seat.z === targetZ)
    .sort(
      (a, b) =>
        Math.abs(a.x - current.x) - Math.abs(b.x - current.x) ||
        a.x - b.x ||
        a.id.localeCompare(b.id),
    )[0]
}
