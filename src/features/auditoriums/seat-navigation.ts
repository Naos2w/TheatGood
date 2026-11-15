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
