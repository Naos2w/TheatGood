import { describe, expect, it } from 'vitest'
import {
  isReferenceSpecialSeat,
  miranewSeatCollectionSummary,
  miranewSeatReferences,
  seatLayoutReferenceById,
  seatLayoutReferencesForCinema,
} from './official-seat-layouts'

describe('public official Miranew seat-chart fact collection', () => {
  it('preserves 13 distinct layout patterns observed across 32 public seat previews', () => {
    expect(miranewSeatCollectionSummary).toMatchObject({
      capturedOn: '2026-11-16',
      sampledCharts: 32,
      samplesFailed: 6,
      distinctLayoutPatterns: 13,
      labelsAcrossPatterns: 1531,
    })
    expect(seatLayoutReferencesForCinema('miranew-taimall')).toHaveLength(8)
    expect(seatLayoutReferencesForCinema('miranew-dazhi-royal')).toHaveLength(5)
    expect(new Set(miranewSeatReferences.map((reference) => reference.id)).size).toBe(13)
  })

  it('never guesses permanent physical hall numbers or invents measured 3D room geometry', () => {
    for (const reference of miranewSeatReferences) {
      expect(reference.physicalHallNumber).toBeNull()
      expect(reference.snapshotSource).toContain('/Movie/SeatView?CinemaId=')
      expect(reference.repeatedInSample).toBeGreaterThan(0)
      expect(reference.totalSeatLabels).toBe(reference.seatPositions.length)
      expect(reference).not.toHaveProperty('modelId')
      expect(reference).not.toHaveProperty('screenWidthM')
      expect(reference).not.toHaveProperty('rowPitchM')
      expect(reference).not.toHaveProperty('availableSeats')
      expect(reference).not.toHaveProperty('soldSeats')
    }
  })

  it('retains official seat labels, grid positions and W-labelled positions without availability', () => {
    const imax = miranewSeatReferences.find(
      (reference) => reference.cinemaSlug === 'miranew-taimall' && reference.category === 'imax',
    )
    expect(imax).toMatchObject({ totalSeatLabels: 329, accessibleSeatLabels: 4 })
    expect(imax?.seatPositions.some(([label]) => label === 'AW14')).toBe(true)
    const royal = miranewSeatReferences.find(
      (reference) => reference.cinemaSlug === 'miranew-taimall' && reference.totalSeatLabels === 44,
    )
    expect(royal?.accessibleSeatLabels).toBe(2)
    expect(royal?.seatPositions.some(([label]) => label === 'WW1')).toBe(true)
    expect(royal?.seatPositions.some(([label]) => label === '5J')).toBe(true)
    expect(isReferenceSpecialSeat('WW1')).toBe(true)
    expect(isReferenceSpecialSeat('AW14')).toBe(true)
    expect(isReferenceSpecialSeat('1W1')).toBe(true)
    expect(isReferenceSpecialSeat('5J')).toBe(false)
    expect(
      miranewSeatReferences.every((r) =>
        r.seatPositions.every(([, row, col]) => row > 0 && col > 0),
      ),
    ).toBe(true)
  })

  it('allows exact lookup for research but not a fabricated unknown hall', () => {
    const reference = miranewSeatReferences[0]!
    expect(seatLayoutReferenceById(reference.id)).toBe(reference)
    expect(seatLayoutReferenceById('miranew-taimall-hall-99')).toBeUndefined()
    expect(seatLayoutReferencesForCinema('vieshow-taipei-hsinyi')).toEqual([])
  })
})
