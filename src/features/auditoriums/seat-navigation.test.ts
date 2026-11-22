import { describe, expect, it } from 'vitest'
import { tfaiSmallAuditorium } from './catalog'
import { createSeats } from './geometry'
import { neighbouringRowSeat, neighbouringSeat } from './seat-navigation'

const seats = createSeats(tfaiSmallAuditorium)

describe('physical neighbouring-seat navigation', () => {
  it('skips missing seat numbers without crossing rows', () => {
    expect(neighbouringSeat(seats, 'E02', 1)?.id).toBe('E05')
    expect(neighbouringSeat(seats, 'E05', -1)?.id).toBe('E02')
  })
  it('disables direction at each row boundary', () => {
    expect(neighbouringSeat(seats, 'E01', -1)).toBeUndefined()
    expect(neighbouringSeat(seats, 'E10', 1)).toBeUndefined()
  })
  it('does not navigate from an invalid seat', () => {
    expect(neighbouringSeat(seats, 'E03', 1)).toBeUndefined()
  })

  it('moves across observed physical rows, choosing the closest horizontal seat', () => {
    const current = seats.find((seat) => seat.id === 'E02')!
    const front = neighbouringRowSeat(seats, current.id, -1)
    const back = neighbouringRowSeat(seats, current.id, 1)
    expect(front?.z).toBeLessThan(current.z)
    expect(back?.z).toBeGreaterThan(current.z)
    expect(Math.abs(front!.x - current.x)).toBeCloseTo(
      Math.min(
        ...seats.filter((seat) => seat.z === front!.z).map((seat) => Math.abs(seat.x - current.x)),
      ),
      7,
    )
  })

  it('does not cross the front or back limits or navigate from missing seats', () => {
    const ordered = [...seats].sort((a, b) => a.z - b.z)
    expect(neighbouringRowSeat(seats, ordered[0]!.id, -1)).toBeUndefined()
    expect(neighbouringRowSeat(seats, ordered.at(-1)!.id, 1)).toBeUndefined()
    expect(neighbouringRowSeat(seats, 'NOT-A-SEAT', 1)).toBeUndefined()
  })

  it('skips absent rows without inventing a seat', () => {
    const positions = [
      { id: 'A01', row: 'A', number: 1, x: 0, z: 2, elevation: 0, eyeY: 1.2 },
      { id: 'A02', row: 'A', number: 2, x: 3, z: 2, elevation: 0, eyeY: 1.2 },
      { id: 'C01', row: 'C', number: 1, x: 0.4, z: 7, elevation: 0.3, eyeY: 1.5 },
      { id: 'C02', row: 'C', number: 2, x: 2.8, z: 7, elevation: 0.3, eyeY: 1.5 },
    ]
    expect(neighbouringRowSeat(positions, 'A02', 1)?.id).toBe('C02')
    expect(neighbouringRowSeat(positions, 'C01', -1)?.id).toBe('A01')
    expect(neighbouringRowSeat(positions, 'A01', -1)).toBeUndefined()
  })
})
