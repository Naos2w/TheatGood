import { describe, expect, it } from 'vitest'
import { tfaiSmallAuditorium } from './catalog'
import { createSeats } from './geometry'
import { neighbouringSeat } from './seat-navigation'

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
})
