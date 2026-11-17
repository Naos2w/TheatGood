import { Group, InstancedMesh, MeshStandardMaterial, Object3D, StaticDrawUsage } from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import type { AuditoriumSeat } from '../auditoriums/geometry'

export type SeatPart = 'frame' | 'back' | 'headrest' | 'cushion' | 'arms' | 'armCaps'

export interface SeatInstanceStats {
  seats: number
  drawCalls: number
  totalInstances: number
}

interface Part {
  name: SeatPart
  hex: number
  total: number
  roughness: number
  metalness?: number
  place: (
    seat: AuditoriumSeat,
    side: -1 | 1 | 0,
    width: number,
  ) => {
    x: number
    y: number
    z: number
    w: number
    h: number
    d: number
    tilt?: number
  }
}

const parts = (seatCount: number): Part[] => [
  {
    name: 'frame',
    hex: 0x1c2633,
    roughness: 0.72,
    total: seatCount,
    place: (s, _side, w) => ({
      x: s.x,
      y: s.elevation + 0.7,
      z: s.z + 0.24,
      w: w * 0.96,
      h: 0.85,
      d: 0.18,
      tilt: -0.065,
    }),
  },
  {
    name: 'back',
    hex: 0x563449,
    roughness: 0.92,
    total: seatCount,
    place: (s, _side, w) => ({
      x: s.x,
      y: s.elevation + 0.73,
      z: s.z + 0.13,
      w: w * 0.84,
      h: 0.66,
      d: 0.12,
      tilt: -0.065,
    }),
  },
  {
    name: 'headrest',
    hex: 0x674054,
    roughness: 0.91,
    total: seatCount,
    place: (s, _side, w) => ({
      x: s.x,
      y: s.elevation + 1.13,
      z: s.z + 0.15,
      w: w * 0.77,
      h: 0.19,
      d: 0.22,
    }),
  },
  {
    name: 'cushion',
    hex: 0x63364a,
    roughness: 0.91,
    total: seatCount,
    place: (s, _side, w) => ({
      x: s.x,
      y: s.elevation + 0.43,
      z: s.z - 0.12,
      w: w * 0.86,
      h: 0.2,
      d: 0.59,
    }),
  },
  {
    name: 'arms',
    hex: 0x1b2430,
    roughness: 0.67,
    total: seatCount * 2,
    place: (s, side, w) => ({
      x: s.x + side * (w * 0.54),
      y: s.elevation + 0.56,
      z: s.z - 0.06,
      w: 0.105,
      h: 0.34,
      d: 0.56,
    }),
  },
  {
    name: 'armCaps',
    hex: 0x4b5261,
    roughness: 0.54,
    metalness: 0.09,
    total: seatCount * 2,
    place: (s, side, w) => ({
      x: s.x + side * (w * 0.54),
      y: s.elevation + 0.78,
      z: s.z - 0.06,
      w: 0.13,
      h: 0.1,
      d: 0.52,
    }),
  },
]

/**
 * Six instanced batches replace hundreds of separate draw calls.
 * Upholstery, style and dimensions are illustrative, never attributed to a real cinema.
 */
export function createCinemaSeatInstances(
  seats: readonly AuditoriumSeat[],
  requestedSeatWidth: number,
): Group {
  if (!seats.length) throw new Error('Cannot instance an empty auditorium')
  if (!Number.isFinite(requestedSeatWidth) || requestedSeatWidth <= 0) {
    throw new RangeError('Seat width must be a positive finite number')
  }
  const width = Math.max(0.46, Math.min(0.78, requestedSeatWidth))
  const group = new Group()
  group.name = 'conceptual-upholstered-seats'
  const dummy = new Object3D()
  for (const part of parts(seats.length)) {
    const geometry = new RoundedBoxGeometry(1, 1, 1, 3, 0.15)
    const material = new MeshStandardMaterial({
      color: part.hex,
      roughness: part.roughness,
      metalness: part.metalness ?? 0.02,
    })
    const batch = new InstancedMesh(geometry, material, part.total)
    batch.name = 'seat-' + part.name
    batch.instanceMatrix.setUsage(StaticDrawUsage)
    batch.frustumCulled = false

    let index = 0
    for (const seat of seats) {
      const sides: Array<-1 | 0 | 1> = part.total === seats.length ? [0] : [-1, 1]
      for (const side of sides) {
        const p = part.place(seat, side, width)
        dummy.position.set(p.x, p.y, p.z)
        dummy.rotation.set(p.tilt ?? 0, 0, 0)
        dummy.scale.set(p.w, p.h, p.d)
        dummy.updateMatrix()
        batch.setMatrixAt(index++, dummy.matrix)
      }
    }
    batch.instanceMatrix.needsUpdate = true
    batch.userData.part = part.name
    group.add(batch)
  }
  group.userData.seats = seats.length
  group.userData.drawCalls = group.children.length
  group.userData.totalInstances = group.children.reduce(
    (n, object) => n + (object instanceof InstancedMesh ? object.count : 0),
    0,
  )
  return group
}

export function cinemaSeatInstanceStats(group: Group): SeatInstanceStats {
  return {
    seats: Number(group.userData.seats),
    drawCalls: Number(group.userData.drawCalls),
    totalInstances: Number(group.userData.totalInstances),
  }
}

export function disposeCinemaSeatInstances(group: Group): void {
  for (const object of group.children) {
    if (object instanceof InstancedMesh) {
      object.geometry.dispose()
      if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose())
      else object.material.dispose()
    }
  }
}
