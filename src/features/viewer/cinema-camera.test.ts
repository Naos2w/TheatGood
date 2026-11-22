import { describe, expect, it } from 'vitest'
import type { CinemaSceneModel } from './cinema-scene-model'
import { loadVieShowArchiveForCinema } from '../cinemas/vieshow-seat-archive'
import { deriveVieShowPreviewGeometry } from './vieshow-approximate-scene'
import { deriveCinemaRoomLayout } from './cinema-room-layout'
import {
  DEFAULT_CINEMA_EYE_AIM,
  cinemaCameraDirection,
  cinemaCameraPosition,
  cinemaCameraTarget,
  cinemaScreenCentreGazeAngles,
} from './cinema-camera'

const referenceHalls = [
  { slug: 'vieshow-taipei-ximen', hall: 7 },
  { slug: 'vieshow-taipei-hsinyi', hall: 11 },
  { slug: 'vieshow-muvie-taipei-a13', hall: 6 },
]

describe('brand-independent auditorium scene and camera', () => {
  it('defaults to the screen-centred seat POV, keeping the level pose optional', () => {
    expect(DEFAULT_CINEMA_EYE_AIM).toBe('screen-centre')
  })

  it('shows the real seat-to-screen aim difference between Banqiao A11 and N31 without moving the eye', async () => {
    const layouts = await loadVieShowArchiveForCinema('vieshow-banqiao-megacity')
    const model = deriveVieShowPreviewGeometry(
      'vieshow-banqiao-megacity',
      layouts.find((item) => item.hallNumber === 6)!,
    )
    const room = deriveCinemaRoomLayout(model.auditorium, model.seats, model.wheelchairSpots)
    const front = model.seats.find((seat) => seat.id === 'A11')!
    const back = model.seats.find((seat) => seat.id === 'N31')!
    const screen = model.auditorium.screen
    const frontAngles = cinemaScreenCentreGazeAngles(front, screen)
    const backAngles = cinemaScreenCentreGazeAngles(back, screen)

    expect(frontAngles.verticalDegrees).toBeGreaterThan(backAngles.verticalDegrees)
    expect(frontAngles.verticalDegrees).toBeGreaterThan(0)
    expect(backAngles.horizontalDegrees).toBeLessThan(0)
    // In this archived grid, A11 is MORE off-axis than N31 despite its shorter row label.
    expect(Math.abs(frontAngles.horizontalDegrees)).toBeGreaterThan(
      Math.abs(backAngles.horizontalDegrees),
    )

    for (const seat of [front, back]) {
      const eye = cinemaCameraPosition(seat, room, 'seat')
      const target = cinemaCameraTarget(screen, room, 'seat', 16 / 9)
      const direction = cinemaCameraDirection(eye, target, 0, 0, DEFAULT_CINEMA_EYE_AIM)
      const actualAim = cinemaScreenCentreGazeAngles(seat, screen)
      expect(
        Math.atan2(direction.y, Math.hypot(direction.x, direction.z)) * (180 / Math.PI),
      ).toBeCloseTo(actualAim.verticalDegrees)
      expect(eye.y).toBe(seat.eyeY)
      expect(cinemaCameraDirection(eye, target, 0, 0, 'eye-level').y).toBeCloseTo(0)
    }

    expect(() => cinemaScreenCentreGazeAngles({ ...front, z: screen.z }, screen)).toThrow(
      RangeError,
    )
  })
  it('does not alter N09 eye position when switching between level and screen-centred head orientation', async () => {
    const layouts = await loadVieShowArchiveForCinema('vieshow-banqiao-megacity')
    const hall = layouts.find((item) => item.hallNumber === 6)!
    const model = deriveVieShowPreviewGeometry('vieshow-banqiao-megacity', hall)
    const seat = model.seats.find((item) => item.id === 'N09')!
    const room = deriveCinemaRoomLayout(model.auditorium, model.seats, model.wheelchairSpots)
    const eye = cinemaCameraPosition(seat, room, 'seat')
    const target = cinemaCameraTarget(model.auditorium.screen, room, 'seat', 16 / 9)

    expect(eye.y).toBeCloseTo(3.41)
    const natural = cinemaCameraDirection(eye, target, 0, 0, 'eye-level')
    const centred = cinemaCameraDirection(eye, target, 0, 0, 'screen-centre')
    expect(natural.y).toBeCloseTo(0)
    expect(centred.y).toBeGreaterThan(0.15)
    expect(natural.x).toBeCloseTo(centred.x)
    expect(natural.length()).toBeCloseTo(1)
    expect(centred.length()).toBeCloseTo(1)
    expect(cinemaCameraPosition(seat, room, 'seat').toArray()).toEqual(eye.toArray())
    expect(cinemaCameraDirection(eye, target, 0, 0.1, 'eye-level').y).toBeGreaterThan(0)
  })

  it('preserves POV and overview poses across three real archived Vie Show seat arrangements', async () => {
    for (const { slug, hall } of referenceHalls) {
      const layouts = await loadVieShowArchiveForCinema(slug)
      const original = layouts.find((item) => item.hallNumber === hall)!
      const model: CinemaSceneModel = deriveVieShowPreviewGeometry(slug, original)
      const room = deriveCinemaRoomLayout(model.auditorium, model.seats, model.wheelchairSpots)
      const sorted = [...model.seats].sort((a, b) => a.z - b.z)
      for (const seat of [sorted[0]!, sorted[Math.floor(sorted.length / 2)]!, sorted.at(-1)!]) {
        const eye = cinemaCameraPosition(seat, room, 'seat')
        expect(eye.toArray()).toEqual([seat.x, seat.eyeY, seat.z])
        const target = cinemaCameraTarget(model.auditorium.screen, room, 'seat', 16 / 9)
        expect(target.z).toBe(model.auditorium.screen.z)
        const look = cinemaCameraDirection(eye, target, 0, 0)
        expect(look.length()).toBeCloseTo(1, 8)
        expect(look.z).toBeLessThan(0)
        const turned = cinemaCameraDirection(eye, target, Math.PI, 0)
        expect(turned.z).toBeGreaterThan(0)
      }
      const seat = sorted[0]!
      const overview = cinemaCameraPosition(seat, room, 'overview')
      expect(overview.x).toBe(0)
      expect(overview.z).toBeCloseTo(room.rearWallZ - 0.85)
      const landscapeTarget = cinemaCameraTarget(model.auditorium.screen, room, 'overview', 16 / 9)
      const portraitTarget = cinemaCameraTarget(model.auditorium.screen, room, 'overview', 0.6)
      expect(portraitTarget.y).toBeLessThan(landscapeTarget.y)
      expect(portraitTarget.x).toBe(landscapeTarget.x)
      expect(portraitTarget.z).toBe(landscapeTarget.z)
      expect(cinemaCameraDirection(overview, landscapeTarget, 0, 0).length()).toBeCloseTo(1)
    }
  })
})
