import type { AuditoriumSeat } from '../auditoriums/geometry'
import type { SceneAuditoriumGeometry } from './vieshow-approximate-scene'

export interface CinemaTier {
  row: string
  z: number
  depth: number
  frontZ: number
  elevation: number
  /** Continuous deck extends down to a shared underfloor datum. */
  height: number
  centerY: number
}

export interface CinemaAisleTrace {
  x: number
  z: number
  width: number
  depth: number
  elevation: number
  row: string
}

export interface CinemaRoomLayout {
  roomWidth: number
  roomHeight: number
  roomDepth: number
  centerZ: number
  frontWallZ: number
  rearWallZ: number
  tiers: CinemaTier[]
  /** Indicative open gaps only: a booking grid is not a certified egress plan. */
  aisleTraces: CinemaAisleTrace[]
  ceilingBaffles: { z: number; depth: number }[]
  acousticPanels: { z: number; height: number }[]
}

function sortedRows(model: SceneAuditoriumGeometry) {
  return [...model.rows].sort((a, b) => a.z - b.z)
}

/** Build visual-stage geometry from the SAME auditorium positions used for 2D/POV. */
export function deriveCinemaRoomLayout(
  model: SceneAuditoriumGeometry,
  seats: readonly AuditoriumSeat[],
  wheelchairSpots: readonly { x: number; z: number; elevation: number }[] = [],
): CinemaRoomLayout {
  if (!model.rows.length || !seats.length)
    throw new Error('A cinema room needs real rows and seats')
  const rows = sortedRows(model)
  if (rows.some((row) => !Number.isFinite(row.z) || !Number.isFinite(row.elevation))) {
    throw new Error('Room rows must have finite geometry')
  }
  const halfOccupied = Math.max(...seats.map((seat) => Math.abs(seat.x)), model.screen.width / 2)
  const roomWidth = Math.max(9, halfOccupied * 2 + 4.4)
  const maxElevation = Math.max(0, ...rows.map((row) => row.elevation))
  const roomHeight = Math.max(
    model.screen.bottomY + model.screen.height + 2.5,
    maxElevation + 4.1,
    6.5,
  )
  const frontWallZ = model.screen.z - 0.65

  const tiers: CinemaTier[] = rows.map((row, index) => {
    const previous = rows[index - 1]
    const next = rows[index + 1]
    const before = previous
      ? (previous.z + row.z) / 2
      : row.z - Math.min(0.65, (next?.z ?? row.z + 1.1) - row.z)
    const after = next
      ? (row.z + next.z) / 2
      : row.z + Math.min(0.75, row.z - (previous?.z ?? row.z - 1.1))
    const depth = Math.max(0.3, after - before)
    const height = Math.max(0.24, row.elevation + 0.24)
    return {
      row: row.label,
      z: (before + after) / 2,
      depth,
      frontZ: before,
      elevation: row.elevation,
      height,
      centerY: (row.elevation - 0.24) / 2,
    }
  })
  const rearWallZ = tiers[tiers.length - 1]!.z + tiers[tiers.length - 1]!.depth / 2 + 2.1
  const roomDepth = rearWallZ - frontWallZ
  const centerZ = (frontWallZ + rearWallZ) / 2

  const seatPitch = model.seatWidth / 0.85
  const aisleTraces: CinemaAisleTrace[] = []
  for (const tier of tiers) {
    const rowSeats = seats.filter((seat) => seat.row === tier.row).sort((a, b) => a.x - b.x)
    for (let i = 1; i < rowSeats.length; i++) {
      const left = rowSeats[i - 1]!
      const right = rowSeats[i]!
      const separation = right.x - left.x
      if (separation < seatPitch * 1.75) continue
      const x = (left.x + right.x) / 2
      if (
        wheelchairSpots.some(
          (spot) =>
            Math.abs(spot.z - tier.z) <= tier.depth / 2 && spot.x > left.x && spot.x < right.x,
        )
      ) {
        continue
      }
      aisleTraces.push({
        x,
        z: tier.z,
        width: Math.min(1.25, Math.max(0.2, separation - model.seatWidth - 0.15)),
        depth: Math.max(0.28, tier.depth - 0.14),
        elevation: tier.elevation,
        row: tier.row,
      })
    }
  }

  const panelCount = Math.max(4, Math.min(13, Math.ceil(roomDepth / 2.6)))
  const acousticPanels = Array.from({ length: panelCount }, (_, i) => ({
    z: frontWallZ + (i + 0.5) * (roomDepth / panelCount),
    height: roomHeight * 0.77,
  }))
  const baffleCount = Math.max(4, Math.min(12, Math.ceil(roomDepth / 2.7)))
  const ceilingBaffles = Array.from({ length: baffleCount }, (_, i) => ({
    z: frontWallZ + (i + 0.5) * (roomDepth / baffleCount),
    depth: Math.max(0.2, roomDepth / baffleCount - 0.14),
  }))
  return {
    roomWidth,
    roomHeight,
    roomDepth,
    centerZ,
    frontWallZ,
    rearWallZ,
    tiers,
    aisleTraces,
    acousticPanels,
    ceilingBaffles,
  }
}
