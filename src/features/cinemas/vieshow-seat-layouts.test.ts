import { describe, expect, it } from 'vitest'
import {
  validateVieShowSeatReference,
  vieshowSeatReferenceForHall,
  vieshowSeatReferences,
  vieshowSeatReferencesForCinema,
  type VieShowSeatReference,
} from './vieshow-seat-layouts'

describe('source-attributed Vie Show public seating previews', () => {
  it('has two identified real Hsin Yi screens whose labels match operator capacities', () => {
    expect(vieshowSeatReferences.map((ref) => ref.physicalHallNumber)).toEqual([6, 11])
    expect(vieshowSeatReferences.map((ref) => ref.ordinarySeatCount)).toEqual([150, 254])
    expect(vieshowSeatReferences.map((ref) => ref.wheelchairMarkers)).toEqual([3, 3])
    for (const reference of vieshowSeatReferences) {
      expect(() => validateVieShowSeatReference(reference)).not.toThrow()
      expect(reference.publishedSeatCount).toBe(reference.seatPositions.length)
      expect(new Set(reference.seatPositions.map(([label]) => label)).size).toBe(
        reference.seatPositions.length,
      )
      expect(reference.snapshotSource).toContain('SessionSeats.aspx?CinemaCode=1&txtSessionId=')
    }
  })

  it('preserves row labels and precise seating gaps instead of inventing a full rectangle', () => {
    const hall6 = vieshowSeatReferenceForHall('vieshow-taipei-hsinyi', 6)!
    const hall11 = vieshowSeatReferenceForHall('vieshow-taipei-hsinyi', 11)!
    expect(hall6.seatPositions.filter((seat) => seat[1] === 1).map((seat) => seat[2])).toEqual([
      2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15,
    ])
    expect(hall11.seatPositions.filter((seat) => seat[1] === 1).map((seat) => seat[2])).toEqual([
      2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 21, 22, 23,
    ])
    expect(hall6.seatPositions.filter((seat) => seat[1] === 13)).toHaveLength(6)
    expect(hall11.seatPositions.filter((seat) => seat[1] === 13)).toHaveLength(14)
    expect(hall6.wheelchairPositions).toHaveLength(3)
    expect(hall11.wheelchairPositions).toHaveLength(3)
    expect(hall6.wheelchairPositions.every(([row]) => row === 13)).toBe(true)
    expect(hall11.wheelchairPositions.every(([row]) => row === 13)).toBe(true)
  })

  it('does not give reference charts unmeasured 3D geometry or temporary availability', () => {
    for (const reference of vieshowSeatReferences) {
      expect(reference).not.toHaveProperty('modelId')
      expect(reference).not.toHaveProperty('screenWidthM')
      expect(reference).not.toHaveProperty('rowPitchM')
      expect(reference).not.toHaveProperty('seatAvailability')
      expect(reference).not.toHaveProperty('soldSeats')
      expect(reference).not.toHaveProperty('bookingPrice')
    }
    expect(vieshowSeatReferencesForCinema('miranew-taimall')).toEqual([])
    expect(vieshowSeatReferenceForHall('vieshow-taipei-hsinyi', 12)).toBeUndefined()
  })

  it('fails closed when the public grid or official hall mapping is altered', () => {
    const original = vieshowSeatReferences[0]!
    const missingSeat: VieShowSeatReference = {
      ...original,
      ordinarySeatCount: original.ordinarySeatCount - 1,
      seatPositions: original.seatPositions.slice(1),
    }
    expect(() => validateVieShowSeatReference(missingSeat)).toThrow(/capacity/)
    const duplicateCell: VieShowSeatReference = {
      ...original,
      seatPositions: [[original.seatPositions[0]![0], 1, 3], ...original.seatPositions.slice(1)],
    }
    expect(() => validateVieShowSeatReference(duplicateCell)).toThrow(/duplicate/)
    const invalidSource: VieShowSeatReference = {
      ...original,
      snapshotSource:
        'https://example.com/VoucherTicketing/SessionSeats.aspx?CinemaCode=1&txtSessionId=1888365',
    }
    expect(() => validateVieShowSeatReference(invalidSource)).toThrow(/source/)
    const unknownHall: VieShowSeatReference = {
      ...original,
      physicalHallNumber: 99,
    }
    expect(() => validateVieShowSeatReference(unknownHall)).toThrow(/hall/)
  })
})
