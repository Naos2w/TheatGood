import { describe, expect, it } from 'vitest'
import { miranewSeatReferences } from '../cinemas/official-seat-layouts'
import { deriveMiranewPattern3D, initialMiranewPatternSeat } from './miranew-pattern-3d'

describe('Miranew public observed pattern 3D preview, without permanent hall claim', () => {
  it('preserves all 13 original public seat patterns with 1531 labels and no invented positions', () => {
    expect(miranewSeatReferences).toHaveLength(13)
    let counted = 0
    for (const pattern of miranewSeatReferences) {
      const scene = deriveMiranewPattern3D(pattern)
      expect(scene.physicalHallNumber).toBeNull()
      expect(scene.sourceIdentity).toBe(
        'operator-public-layout-pattern-without-physical-hall-number',
      )
      expect(scene.geometryMeasured).toBe(false)
      expect(scene.screenDimensionsProvenance).toBe('estimated')
      expect(scene.wheelchairPositionsIndependentlyVerified).toBe(false)
      expect(scene.wheelchairSpots).toEqual([])
      expect(scene.seats).toHaveLength(pattern.totalSeatLabels)
      expect(scene.seats.map((seat) => seat.id)).toEqual(
        pattern.seatPositions.map(([label]) => label),
      )
      expect(new Set(scene.seats.map((seat) => seat.id)).size).toBe(pattern.totalSeatLabels)
      expect(new Set(scene.seats.map((seat) => seat.x + '/' + seat.z)).size).toBe(
        pattern.totalSeatLabels,
      )
      expect(scene.auditorium.screen.width).toBeGreaterThan(0)
      expect(scene.auditorium.screen.height).toBeCloseTo(scene.auditorium.screen.width / 1.9)
      expect(scene.seats.every((seat) => Number.isFinite(seat.x + seat.z + seat.eyeY))).toBe(true)
      expect(scene.seats.some((seat) => seat.id === initialMiranewPatternSeat(scene))).toBe(true)
      counted += scene.seats.length
    }
    expect(counted).toBe(1531)
  })

  it('does not accept a claimed physical hall number for an unnumbered source', () => {
    const original = miranewSeatReferences[0]!
    expect(() => deriveMiranewPattern3D({ ...original, physicalHallNumber: 7 } as never)).toThrow(
      /permanent hall number/,
    )
  })
})
