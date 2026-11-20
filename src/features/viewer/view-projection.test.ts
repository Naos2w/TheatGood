import { describe, expect, it } from 'vitest'
import {
  horizontalFovFromVertical,
  verticalFovFromHorizontal,
  responsiveCinemaFov,
} from './view-projection'

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

  it('uses device-aware camera framing without changing the physical auditorium', () => {
    const desktop = responsiveCinemaFov(80, 1920, 1080)
    const tabletLandscape = responsiveCinemaFov(80, 1180, 820)
    const tabletPortrait = responsiveCinemaFov(80, 820, 1180)
    const phoneLandscape = responsiveCinemaFov(80, 844, 390)
    const phonePortrait = responsiveCinemaFov(80, 390, 844)
    const ultrawide = responsiveCinemaFov(80, 3440, 1440)

    expect(desktop.effectiveHorizontalDegrees).toBeCloseTo(80, 6)
    expect(desktop.verticalDegrees).toBeGreaterThan(45)
    expect(desktop.verticalDegrees).toBeLessThan(60)
    expect(desktop.portraitSideCrop).toBe(false)
    expect(tabletLandscape.effectiveHorizontalDegrees).toBeCloseTo(80, 6)
    expect(tabletPortrait.verticalDegrees).toBeCloseTo(78)
    expect(tabletPortrait.portraitSideCrop).toBe(true)
    expect(phonePortrait.verticalDegrees).toBeCloseTo(78)
    expect(phonePortrait.effectiveHorizontalDegrees).toBeLessThan(80)
    expect(phonePortrait.portraitSideCrop).toBe(true)
    expect(phoneLandscape.verticalDegrees).toBeGreaterThan(40)
    expect(phoneLandscape.verticalDegrees).toBeLessThan(55)
    expect(phoneLandscape.portraitSideCrop).toBe(false)
    expect(ultrawide.verticalDegrees).toBeGreaterThanOrEqual(42)
    expect(ultrawide.effectiveHorizontalDegrees).toBeGreaterThan(80)

    for (const item of [
      desktop,
      tabletLandscape,
      tabletPortrait,
      phoneLandscape,
      phonePortrait,
      ultrawide,
    ]) {
      expect(horizontalFovFromVertical(item.verticalDegrees, item.aspect)).toBeCloseTo(
        item.effectiveHorizontalDegrees,
        6,
      )
    }
  })

  it('rejects invalid viewport or view angles', () => {
    expect(() => responsiveCinemaFov(80, 0, 900)).toThrow(RangeError)
    expect(() => responsiveCinemaFov(80, 390, Number.NaN)).toThrow(RangeError)
    expect(() => responsiveCinemaFov(0, 390, 844)).toThrow(RangeError)
    expect(() => verticalFovFromHorizontal(0, 1)).toThrow(RangeError)
    expect(() => verticalFovFromHorizontal(180, 1)).toThrow(RangeError)
    expect(() => verticalFovFromHorizontal(80, 0)).toThrow(RangeError)
    expect(() => horizontalFovFromVertical(0, 1)).toThrow(RangeError)
    expect(() => horizontalFovFromVertical(80, Number.NaN)).toThrow(RangeError)
  })
})
