import { describe, expect, it } from 'vitest'
import { tfaiSmallAuditorium } from '../auditoriums/catalog'
import { createSeats } from '../auditoriums/geometry'
import { swapObservedSeatComparison } from './seat-comparison'

const seats = createSeats(tfaiSmallAuditorium)

describe('3D comparison of two source-observed seats', () => {
  it('swaps the current and saved seat without altering labels or geometry', () => {
    const first = swapObservedSeatComparison(seats, 'E02', 'E05')
    expect(first).toEqual({ nextSelected: 'E05', nextSaved: 'E02' })
    const back = swapObservedSeatComparison(seats, first!.nextSelected, first!.nextSaved)
    expect(back).toEqual({ nextSelected: 'E02', nextSaved: 'E05' })
    expect(seats.some((seat) => seat.id === 'E02')).toBe(true)
    expect(seats.some((seat) => seat.id === 'E05')).toBe(true)
  })
  it('cannot compare nonexistent, empty or identical seats', () => {
    expect(swapObservedSeatComparison(seats, '', 'E05')).toBeNull()
    expect(swapObservedSeatComparison(seats, 'E02', '')).toBeNull()
    expect(swapObservedSeatComparison(seats, 'E02', 'E02')).toBeNull()
    expect(swapObservedSeatComparison(seats, 'E02', 'E03')).toBeNull()
    expect(swapObservedSeatComparison(seats, 'NOT_PRESENT', 'E05')).toBeNull()
  })
  it('refuses to use a saved seat from a different hall', () => {
    const newHall = seats.filter((seat) => seat.row === 'A')
    expect(swapObservedSeatComparison(newHall, 'A01', 'E02')).toBeNull()
  })
})
