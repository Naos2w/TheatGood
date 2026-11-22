import type { AuditoriumSeat } from '../auditoriums/geometry'

/**
 * Switch between two source-observed seats in ONE auditorium without creating
 * or modifying any geometry. Both seats must exist in the current hall.
 */
export function swapObservedSeatComparison(
  seats: readonly AuditoriumSeat[],
  currentSeatId: string,
  otherSeatId: string,
): { nextSelected: string; nextSaved: string } | null {
  if (!currentSeatId || !otherSeatId || currentSeatId === otherSeatId) return null
  const available = new Set(seats.map((seat) => seat.id))
  if (!available.has(currentSeatId) || !available.has(otherSeatId)) return null
  return { nextSelected: otherSeatId, nextSaved: currentSeatId }
}
