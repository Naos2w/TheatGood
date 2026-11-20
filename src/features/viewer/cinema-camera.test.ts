import { describe, expect, it } from 'vitest'
import type { CinemaSceneModel } from './cinema-scene-model'
import { loadVieShowArchiveForCinema } from '../cinemas/vieshow-seat-archive'
import { deriveVieShowPreviewGeometry } from './vieshow-approximate-scene'
import { deriveCinemaRoomLayout } from './cinema-room-layout'
import { cinemaCameraDirection, cinemaCameraPosition, cinemaCameraTarget } from './cinema-camera'

const referenceHalls = [
  { slug: 'vieshow-taipei-ximen', hall: 7 },
  { slug: 'vieshow-taipei-hsinyi', hall: 11 },
  { slug: 'vieshow-muvie-taipei-a13', hall: 6 },
]

describe('brand-independent auditorium scene and camera', () => {
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
