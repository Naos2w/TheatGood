import { describe, expect, it } from 'vitest'
import { InstancedMesh, Matrix4, Vector3 } from 'three'
import { chainCinemas } from '../cinemas/chain-directory'
import { loadVieShowArchiveForCinema } from '../cinemas/vieshow-seat-archive'
import { calculateSightline } from '../auditoriums/geometry'
import { deriveVieShowPreviewGeometry } from './vieshow-approximate-scene'
import { deriveCinemaRoomLayout } from './cinema-room-layout'
import {
  createCinemaSeatInstances,
  cinemaSeatInstanceStats,
  disposeCinemaSeatInstances,
} from './cinema-seat-instances'

describe('estimated theatre scene geometry and batched seat detail', () => {
  it('builds continuous tier decks for the 391-seat A13 reference, without inventing seats', async () => {
    const data = await loadVieShowArchiveForCinema('vieshow-muvie-taipei-a13')
    const titan = data.find((item) => item.hallNumber === 6)!
    const { seats, auditorium, wheelchairSpots } = deriveVieShowPreviewGeometry(
      'vieshow-muvie-taipei-a13',
      titan,
    )
    const room = deriveCinemaRoomLayout(auditorium, seats, wheelchairSpots)
    expect(seats).toHaveLength(391)
    expect(room.tiers).toHaveLength(auditorium.rows.length)
    expect(room.roomWidth).toBeGreaterThan(auditorium.screen.width)
    expect(room.roomHeight).toBeGreaterThan(auditorium.screen.bottomY + auditorium.screen.height)
    expect(room.roomDepth).toBeGreaterThan(seats.at(-1)!.z - auditorium.screen.z)
    expect(room.tiers.map((tier) => tier.row)).toEqual(auditorium.rows.map((row) => row.label))
    for (const tier of room.tiers) {
      expect(tier.depth).toBeGreaterThan(0)
      expect(tier.height).toBeGreaterThan(0)
      expect(tier.centerY + tier.height / 2).toBeCloseTo(tier.elevation, 5)
    }
    expect(room.ceilingBaffles.length).toBeGreaterThanOrEqual(4)
    expect(room.acousticPanels.length).toBeGreaterThanOrEqual(4)
    expect(room.aisleTraces.every((gap) => gap.width > 0 && gap.depth > 0)).toBe(true)
  })

  it('all 222 archived seat layouts produce finite tier and aisle geometry', async () => {
    let seen = 0
    const venues = chainCinemas.filter((venue) => venue.brand === 'vieshow')
    for (const venue of venues) {
      const layouts = await loadVieShowArchiveForCinema(venue.slug)
      for (const layout of layouts) {
        const converted = deriveVieShowPreviewGeometry(venue.slug, layout)
        const room = deriveCinemaRoomLayout(
          converted.auditorium,
          converted.seats,
          converted.wheelchairSpots,
        )
        expect(room.roomWidth).toBeGreaterThan(0)
        expect(room.roomHeight).toBeGreaterThan(0)
        expect(Number.isFinite(room.roomDepth)).toBe(true)
        expect(room.tiers).toHaveLength(converted.auditorium.rows.length)
        expect(room.rearWallZ).toBeGreaterThan(converted.seats[0]!.z)
        const originalSeats = new Set(layout.seatPositions.map((item) => item[0]))
        expect(new Set(converted.seats.map((seat) => seat.id))).toEqual(originalSeats)
        seen++
      }
    }
    expect(seen).toBe(222)
  })

  it('renders a packed 391-seat auditorium in six instanced batches, not 3000 meshes', async () => {
    const data = await loadVieShowArchiveForCinema('vieshow-muvie-taipei-a13')
    const titan = data.find((item) => item.hallNumber === 6)!
    const model = deriveVieShowPreviewGeometry('vieshow-muvie-taipei-a13', titan)
    const group = createCinemaSeatInstances(model.seats, model.auditorium.seatWidth)
    const stats = cinemaSeatInstanceStats(group)
    expect(stats).toEqual({ seats: 391, drawCalls: 6, totalInstances: 391 * 8 })
    expect(group.children.every((mesh) => mesh instanceof InstancedMesh)).toBe(true)
    const back = group.children.find((mesh) => mesh.name === 'seat-frame') as InstancedMesh
    const matrix = new Matrix4()
    back.getMatrixAt(0, matrix)
    const seatPosition = new Vector3().setFromMatrixPosition(matrix)
    expect(back.count).toBe(391)
    expect(seatPosition.x).toBeCloseTo(model.seats[0]!.x)
    disposeCinemaSeatInstances(group)
  })

  it('preserves the seat centre for every frame instance, with a headrest behind the eye', async () => {
    const data = await loadVieShowArchiveForCinema('vieshow-taipei-hsinyi')
    const hall = data.find((item) => item.hallNumber === 11)!
    const model = deriveVieShowPreviewGeometry('vieshow-taipei-hsinyi', hall)
    const group = createCinemaSeatInstances(model.seats, model.auditorium.seatWidth)
    const back = group.children.find((mesh) => mesh.name === 'seat-frame') as InstancedMesh
    const cushion = group.children.find((mesh) => mesh.name === 'seat-cushion') as InstancedMesh
    const backMatrix = new Matrix4(),
      cushionMatrix = new Matrix4()
    back.getMatrixAt(0, backMatrix)
    cushion.getMatrixAt(0, cushionMatrix)
    const backWorld = new Vector3().setFromMatrixPosition(backMatrix)
    const cushionWorld = new Vector3().setFromMatrixPosition(cushionMatrix)
    expect(backWorld.x).toBeCloseTo(model.seats[0]!.x)
    expect(cushionWorld.z).toBeLessThan(backWorld.z)
    expect(backWorld.y).toBeCloseTo(model.seats[0]!.elevation + 0.7)
    expect(model.seats[0]!.eyeY).toBeGreaterThan(backWorld.y)
    disposeCinemaSeatInstances(group)
  })

  it('keeps simulated sightlines finite for front, centre, rear and edge seats in representative halls', async () => {
    const cases = [
      { slug: 'vieshow-muvie-taipei-a13', hallNumber: 6 },
      { slug: 'vieshow-taipei-hsinyi', hallNumber: 11 },
      { slug: 'vieshow-taipei-ximen', hallNumber: 7 },
    ]
    for (const item of cases) {
      const halls = await loadVieShowArchiveForCinema(item.slug)
      const hall = halls.find((layout) => layout.hallNumber === item.hallNumber)!
      const result = deriveVieShowPreviewGeometry(item.slug, hall)
      const byDepth = [...result.seats].sort((a, b) => a.z - b.z || a.x - b.x)
      const bySide = [...result.seats].sort((a, b) => a.x - b.x)
      const samples = [
        byDepth[0]!,
        byDepth[Math.floor(byDepth.length / 2)]!,
        byDepth.at(-1)!,
        bySide[0]!,
        bySide.at(-1)!,
      ]
      for (const seat of samples) {
        const measuredByModel = calculateSightline(seat, result.auditorium.screen)
        expect(measuredByModel.distance).toBeGreaterThan(0)
        expect(Number.isFinite(measuredByModel.horizontalAngle)).toBe(true)
        expect(Number.isFinite(measuredByModel.verticalAngle)).toBe(true)
        expect(Number.isFinite(measuredByModel.horizontalOffset)).toBe(true)
        expect(measuredByModel.horizontalAngle).toBeGreaterThan(0)
      }
      const room = deriveCinemaRoomLayout(result.auditorium, result.seats, result.wheelchairSpots)
      expect(room.rearWallZ).toBeGreaterThan(Math.max(...result.seats.map((seat) => seat.z)))
    }
  })

  it('rejects an impossible seat instance width or an empty auditorium', () => {
    expect(() => createCinemaSeatInstances([], 0.6)).toThrow(/empty/)
    expect(() =>
      createCinemaSeatInstances(
        [{ id: 'A01', row: 'A', number: 1, x: 0, z: 5, elevation: 0, eyeY: 1.17 }],
        Number.NaN,
      ),
    ).toThrow(/positive finite/)
  })
})
