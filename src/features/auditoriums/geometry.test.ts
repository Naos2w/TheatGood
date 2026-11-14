import { describe, expect, it } from 'vitest'
import { calculateSightline, createSeats } from './geometry'
import { demoAuditorium } from './demo'

describe('auditorium geometry', () => {
  const seats = createSeats(demoAuditorium)

  it('creates unique, numbered seats for every row', () => {
    expect(seats).toHaveLength(
      demoAuditorium.rows.reduce((sum, row) => sum + row.numbers.length, 0),
    )
    expect(new Set(seats.map((seat) => seat.id)).size).toBe(seats.length)
    expect(seats.find((seat) => seat.id === 'E07')).toBeDefined()
  })

  it('uses symmetric seating and leaves additional space at aisles', () => {
    const e = seats.filter((seat) => seat.row === 'E')
    expect(e[0]!.x).toBeCloseTo(-e.at(-1)!.x)
    const normalGap = e[1]!.x - e[0]!.x
    const aisleGap = e[5]!.x - e[4]!.x
    expect(aisleGap).toBeGreaterThan(normalGap)
    expect(aisleGap).toBeCloseTo(normalGap + demoAuditorium.aisleWidth)
  })

  it('gives rear rows higher elevations and correct eye heights', () => {
    const front = seats.find((seat) => seat.id === 'A01')!
    const back = seats.find((seat) => seat.id === 'I01')!
    expect(back.eyeY).toBeGreaterThan(front.eyeY)
    expect(front.eyeY).toBeCloseTo(front.elevation + demoAuditorium.eyeHeight)
  })

  it('reports wider screen angle from a front row than a back row', () => {
    const front = seats.find((seat) => seat.id === 'A05')!
    const back = seats.find((seat) => seat.id === 'I06')!
    const a = calculateSightline(front, demoAuditorium.screen)
    const b = calculateSightline(back, demoAuditorium.screen)
    expect(a.horizontalAngle).toBeGreaterThan(b.horizontalAngle)
    expect(a.verticalAngle).toBeGreaterThan(b.verticalAngle)
    expect(a.distance).toBeLessThan(b.distance)
  })

  it('changes horizontal offset sign across the centre', () => {
    const left = seats.find((seat) => seat.id === 'E01')!
    const right = seats.find((seat) => seat.id === 'E14')!
    const a = calculateSightline(left, demoAuditorium.screen)
    const b = calculateSightline(right, demoAuditorium.screen)
    expect(a.horizontalOffset).toBeGreaterThan(0)
    expect(b.horizontalOffset).toBeLessThan(0)
    expect(a.horizontalAngle).toBeCloseTo(b.horizontalAngle)
  })

  it('rejects a screen behind the chosen seat', () => {
    const seat = seats[0]!
    expect(() => calculateSightline(seat, { ...demoAuditorium.screen, z: seat.z + 1 })).toThrow(
      RangeError,
    )
  })
})
