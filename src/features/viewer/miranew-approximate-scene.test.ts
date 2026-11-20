import { describe, expect, it } from 'vitest'
import { isReferenceSpecialSeat, miranewSeatReferences } from '../cinemas/official-seat-layouts'
import { defaultSourcedGridParameters, deriveSourcedGridScene } from './sourced-grid-scene'
import {
  deriveMiranewPreviewGeometry,
  initialMiranewPreviewSeat,
} from './miranew-approximate-scene'

describe('Miranew sourced seat-chart -> shared proportional 3D preview', () => {
  it('prepares all 13 distinct public seat layouts without inventing a numbered hall', () => {
    let allLabels = 0
    let allOrdinary = 0
    let allSpecial = 0
    for (const pattern of miranewSeatReferences) {
      const model = deriveMiranewPreviewGeometry(pattern)
      const ordinaryLabels = pattern.seatPositions
        .filter(([label]) => !isReferenceSpecialSeat(label))
        .map(([label]) => label)
      const accessibleCount = pattern.seatPositions.filter(([label]) =>
        isReferenceSpecialSeat(label),
      ).length

      expect(model.physicalHallNumber).toBeNull()
      expect(model.screenDimensionsProvenance).toBe('estimated')
      expect(model.seatPositionsProvenance).toBe('operator-public-booking-preview')
      expect(model.calibration.method).toBe('grid-only-estimate')
      expect(model.calibration.ratioVerifiedAgainstScaledFloorPlan).toBe(false)
      expect(model.auditorium.id).toBe('sourced-grid-preview-' + pattern.id)
      expect(model.seats.map((seat) => seat.id)).toEqual(ordinaryLabels)
      expect(model.wheelchairSpots).toHaveLength(accessibleCount)
      expect(model.seats.every((seat) => seat.eyeY > seat.elevation)).toBe(true)
      expect(model.seats.every((seat) => Number.isFinite(seat.x + seat.z))).toBe(true)
      expect(model.wheelchairSpots.every((spot) => Number.isFinite(spot.x + spot.z))).toBe(true)
      expect(model.auditorium.screen.width).toBeGreaterThan(0)
      expect(model.auditorium.screen.height).toBeGreaterThan(0)
      expect(model.auditorium.screen.width / model.auditorium.screen.height).toBeCloseTo(1.9)
      expect(new Set(model.seats.map((seat) => seat.id)).size).toBe(model.seats.length)
      expect(ordinaryLabels).toContain(initialMiranewPreviewSeat(model))
      expect(model.seats.some((seat) => isReferenceSpecialSeat(seat.id))).toBe(false)
      allLabels += pattern.totalSeatLabels
      allOrdinary += model.seats.length
      allSpecial += model.wheelchairSpots.length
    }
    expect(miranewSeatReferences).toHaveLength(13)
    expect(allLabels).toBe(1531)
    expect(allOrdinary + allSpecial).toBe(allLabels)
  })

  it('keeps IMAX, royal and standard booking layouts separate from screen geometry guesses', () => {
    const imax = miranewSeatReferences.find((entry) => entry.category === 'imax')!
    expect(imax.totalSeatLabels).toBe(329)
    const model = deriveMiranewPreviewGeometry(imax)
    expect(model.seats).toHaveLength(325)
    expect(model.wheelchairSpots).toHaveLength(4)
    expect(model.seats.some((seat) => seat.id === 'AW14')).toBe(false)
    expect(model.auditorium.screen).not.toHaveProperty('projectionAspectRatio')
    expect(model.auditorium.screen).not.toHaveProperty('tiltDegrees')

    const royal = miranewSeatReferences.find((entry) => entry.cinemaSlug === 'miranew-dazhi-royal')!
    const royalModel = deriveMiranewPreviewGeometry(royal)
    expect(royalModel.seats.length + royalModel.wheelchairSpots.length).toBe(36)
    expect(royalModel.physicalHallNumber).toBeNull()
  })

  it('adjusts estimated dimensions only; keeps every source seat ID and special marker', () => {
    const pattern = miranewSeatReferences.find((entry) => entry.category === 'imax')!
    const before = deriveMiranewPreviewGeometry(pattern)
    const changed = deriveMiranewPreviewGeometry(pattern, {
      ...defaultSourcedGridParameters,
      seatSpacingM: 0.82,
      rowSpacingM: 1.22,
      rowRiseM: 0.24,
      frontDistanceM: 7.4,
    })
    expect(changed.seats.map((seat) => seat.id)).toEqual(before.seats.map((seat) => seat.id))
    expect(changed.seats[0]?.x).not.toBe(before.seats[0]?.x)
    expect(changed.seats[0]?.z).not.toBe(before.seats[0]?.z)
    expect(changed.wheelchairSpots).toHaveLength(before.wheelchairSpots.length)
    expect(changed.screenDimensionsProvenance).toBe('estimated')
    expect(changed.physicalHallNumber).toBeNull()
  })

  it('fails closed for unsourced seats, duplicate cells or a fabricated hall number', () => {
    const pattern = miranewSeatReferences[0]!
    expect(() =>
      deriveMiranewPreviewGeometry({ ...pattern, physicalHallNumber: 8 } as never),
    ).toThrow(/permanent hall/)
    expect(() => deriveSourcedGridScene({ id: 'example', seats: [] })).toThrow(
      /sourced seat positions/,
    )
    expect(() =>
      deriveSourcedGridScene({
        id: 'example',
        seats: [
          ['A01', 1, 1],
          ['A02', 1, 1],
        ],
      }),
    ).toThrow(/Duplicate sourced grid position/)
    expect(() =>
      deriveSourcedGridScene({
        id: 'example',
        seats: [['A01', 1, 1]],
        specialPositions: [[1, 1]],
      }),
    ).toThrow(/Duplicate sourced grid position/)
    expect(() =>
      deriveSourcedGridScene({
        id: 'example',
        seats: [['A01', 1, 1]],
        screenWidthM: 21,
      }),
    ).toThrow(/width AND height/)
  })
})
