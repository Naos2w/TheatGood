import { describe, expect, it } from 'vitest'
import { demoAuditorium } from './demo'
import { auditoriumSchema } from './schema'
import { deriveScreenProjection } from './screen-projection'

describe('physical screen and projected picture geometry', () => {
  const screen = demoAuditorium.screen

  it('preserves the existing full-screen geometry when no optional measurement is supplied', () => {
    const projection = deriveScreenProjection(screen)
    expect(projection.width).toBe(screen.width)
    expect(projection.height).toBe(screen.height)
    expect(projection.rotationX).toBe(0)
    expect(projection.topY).toBe(screen.bottomY + screen.height)
    expect(projection.bottomY).toBeCloseTo(screen.bottomY)
    expect(projection.topZ).toBe(screen.z)
    expect(projection.bottomZ).toBe(screen.z)
  })

  it('letterboxes a wider film without changing the physical screen dimensions', () => {
    const projection = deriveScreenProjection({ ...screen, projectionAspectRatio: 2.39 })
    expect(projection.width).toBe(screen.width)
    expect(projection.height).toBeCloseTo(screen.width / 2.39)
    expect(projection.topY).toBeLessThan(screen.bottomY + screen.height)
    expect(projection.bottomY).toBeGreaterThan(screen.bottomY)
  })

  it('pillarboxes a narrower film and tilts the top towards the audience', () => {
    const projection = deriveScreenProjection({
      ...screen,
      tiltDegrees: 15,
      projectionAspectRatio: 1.33,
    })
    expect(projection.height).toBe(screen.height)
    expect(projection.width).toBeCloseTo(screen.height * 1.33)
    expect(projection.rotationX).toBeCloseTo(Math.PI / 12)
    expect(projection.topZ).toBeGreaterThan(screen.z)
    expect(projection.bottomZ).toBeLessThan(screen.z)
    expect(projection.topY - projection.bottomY).toBeCloseTo(screen.height * Math.cos(Math.PI / 12))
  })

  it('accepts optional screen parameters in the published auditorium schema, but rejects implausible ones', () => {
    const model = {
      ...demoAuditorium,
      screen: { ...screen, tiltDegrees: 12, projectionAspectRatio: 2.39 },
    }
    expect(auditoriumSchema.safeParse(model).success).toBe(true)
    expect(
      auditoriumSchema.safeParse({ ...model, screen: { ...model.screen, tiltDegrees: 50 } })
        .success,
    ).toBe(false)
    expect(
      auditoriumSchema.safeParse({
        ...model,
        screen: { ...model.screen, projectionAspectRatio: -2 },
      }).success,
    ).toBe(false)
  })

  it('refuses invalid non-finite geometry even when supplied without schema validation', () => {
    expect(() => deriveScreenProjection({ ...screen, width: Number.NaN })).toThrow(RangeError)
    expect(() => deriveScreenProjection({ ...screen, tiltDegrees: 45 })).toThrow(RangeError)
    expect(() => deriveScreenProjection({ ...screen, projectionAspectRatio: 0 })).toThrow(
      RangeError,
    )
  })
})
