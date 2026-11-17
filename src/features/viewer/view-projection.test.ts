import { describe, expect, it } from 'vitest'
import { horizontalFovFromVertical, verticalFovFromHorizontal } from './view-projection'

describe('3D projection lens across screen orientations', () => {
  it('keeps the user-selected horizontal angular field constant when aspect changes', () => {
    for (const horizontal of [65, 80, 95]) {
      for (const aspect of [390 / 844, 844 / 390, 16 / 9, 4 / 3]) {
        const vertical = verticalFovFromHorizontal(horizontal, aspect)
        expect(horizontalFovFromVertical(vertical, aspect)).toBeCloseTo(horizontal, 7)
        expect(vertical).toBeGreaterThan(0)
        expect(vertical).toBeLessThan(180)
      }
    }
  })

  it('widens the vertical field in portrait instead of shrinking the horizontal view', () => {
    const desktop = verticalFovFromHorizontal(80, 16 / 9)
    const portrait = verticalFovFromHorizontal(80, 390 / 844)
    expect(desktop).toBeGreaterThan(45)
    expect(desktop).toBeLessThan(60)
    expect(portrait).toBeGreaterThan(110)
    expect(portrait).toBeLessThan(135)
  })

  it('rejects invalid viewport or view angles', () => {
    expect(() => verticalFovFromHorizontal(0, 1)).toThrow(RangeError)
    expect(() => verticalFovFromHorizontal(180, 1)).toThrow(RangeError)
    expect(() => verticalFovFromHorizontal(80, 0)).toThrow(RangeError)
    expect(() => horizontalFovFromVertical(0, 1)).toThrow(RangeError)
    expect(() => horizontalFovFromVertical(80, Number.NaN)).toThrow(RangeError)
  })
})
