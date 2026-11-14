import { describe, expect, it } from 'vitest'
import { tfaiSmallAuditorium } from './catalog'
import { calculateSightline, createSeats } from './geometry'
import { loadAuditorium } from './schema'
import rawTfaiSmall from './tfai-small.json'
import { demoAuditorium } from './demo'

describe('TFAI small auditorium — official source mapping', () => {
  const auditorium = tfaiSmallAuditorium
  const seats = createSeats(auditorium)

  it('matches the 52 seats from the official equipment manual (wheelchair spaces excluded)', () => {
    expect(auditorium.screen.width).toBe(8.88)
    expect(auditorium.screen.height).toBe(4.8)
    expect(auditorium.publishedSeatCount).toBe(52)
    expect(seats).toHaveLength(52)
    expect(new Set(seats.map((seat) => seat.id)).size).toBe(52)
    expect(auditorium.rows.map((row) => row.label)).toEqual(['A', 'B', 'C', 'D', 'E', 'F'])
  })

  it('keeps gaps in official seat numbers instead of inventing seats', () => {
    expect(seats.some((seat) => seat.id === 'A06')).toBe(false)
    expect(seats.some((seat) => seat.id === 'C03')).toBe(false)
    expect(seats.some((seat) => seat.id === 'D04')).toBe(false)
    expect(seats.some((seat) => seat.id === 'E03')).toBe(false)
    expect(seats.some((seat) => seat.id === 'F10')).toBe(true)
  })

  it('uses row spacing gaps consistently in 3D positions', () => {
    const a05 = seats.find((seat) => seat.id === 'A05')!
    const a07 = seats.find((seat) => seat.id === 'A07')!
    const b05 = seats.find((seat) => seat.id === 'B05')!
    const b06 = seats.find((seat) => seat.id === 'B06')!
    expect(a07.x - a05.x).toBeCloseTo(2 * auditorium.seatSpacing)
    expect(b06.x - b05.x).toBeCloseTo(auditorium.seatSpacing)
  })

  it('reports estimated viewing geometry, not measured seat coordinates', () => {
    expect(auditorium.provenance.screenDimensions).toBe('official')
    expect(auditorium.provenance.seatLabels).toBe('official')
    expect(auditorium.provenance.spatialGeometry).toBe('estimated')
    expect(auditorium.sources[0]).toContain('tfai.org.tw')
    const front = seats.find((seat) => seat.id === 'A05')!
    const back = seats.find((seat) => seat.id === 'F05')!
    expect(calculateSightline(front, auditorium.screen).horizontalAngle).toBeGreaterThan(
      calculateSightline(back, auditorium.screen).horizontalAngle,
    )
  })

  it('keeps left and right seats on opposite sides of the screen in an estimated model', () => {
    const left = seats.find((seat) => seat.id === 'F01')!
    const middle = seats.find((seat) => seat.id === 'F05')!
    const right = seats.find((seat) => seat.id === 'F10')!
    expect(left.x).toBeLessThan(middle.x)
    expect(middle.x).toBeLessThan(right.x)
    expect(calculateSightline(left, auditorium.screen).horizontalOffset).toBeGreaterThan(0)
    expect(calculateSightline(right, auditorium.screen).horizontalOffset).toBeLessThan(0)
  })

  it('validates the source JSON and rejects a mismatched published seat count', () => {
    expect(loadAuditorium(rawTfaiSmall)).toEqual(auditorium)
    expect(() => loadAuditorium({ ...rawTfaiSmall, publishedSeatCount: 53 })).toThrow(
      /座位總數與模型不一致/,
    )
    expect(() => loadAuditorium({ ...rawTfaiSmall, sources: [] })).toThrow(/官方資料須有來源連結/)
  })

  it('keeps the imaginary demo a separate estimated model', () => {
    expect(loadAuditorium(demoAuditorium).confidence).toBe('estimated')
    expect(demoAuditorium.provenance.seatLabels).toBe('estimated')
  })
})
