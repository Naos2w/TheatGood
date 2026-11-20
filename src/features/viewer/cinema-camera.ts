import { Vector3 } from 'three'
import type { AuditoriumSeat } from '../auditoriums/geometry'
import type { ScreenDefinition } from '../auditoriums/schema'
import type { CinemaRoomLayout } from './cinema-room-layout'

export type CinemaViewMode = 'seat' | 'overview'

/** Shared POV / overview poses; no chain-specific seat number or geometry assumptions. */
export function cinemaCameraPosition(
  selected: AuditoriumSeat,
  room: CinemaRoomLayout,
  mode: CinemaViewMode,
): Vector3 {
  return mode === 'overview'
    ? new Vector3(0, Math.min(room.roomHeight - 1.1, room.roomHeight * 0.73), room.rearWallZ - 0.85)
    : new Vector3(selected.x, selected.eyeY, selected.z)
}

export function cinemaCameraTarget(
  screen: ScreenDefinition,
  room: CinemaRoomLayout,
  mode: CinemaViewMode,
  aspect: number,
): Vector3 {
  if (mode !== 'overview')
    return new Vector3(screen.centerX, screen.bottomY + screen.height / 2, screen.z)

  const height =
    aspect < 0.7 ? Math.max(0.85, room.roomHeight * 0.12) : Math.max(1.4, room.roomHeight * 0.31)
  return new Vector3(screen.centerX, height, room.frontWallZ + room.roomDepth * 0.29)
}

/** Preserve world-up when rotating far behind the seat (no camera roll). */
export function cinemaCameraDirection(
  position: Vector3,
  target: Vector3,
  yaw: number,
  pitch: number,
): Vector3 {
  const delta = target.clone().sub(position)
  const baseYaw = Math.atan2(delta.x, -delta.z)
  const basePitch = Math.atan2(delta.y, Math.hypot(delta.x, delta.z))
  const finalYaw = baseYaw + yaw
  const finalPitch = Math.max(-1.25, Math.min(1.25, basePitch + pitch))
  return new Vector3(
    Math.sin(finalYaw) * Math.cos(finalPitch),
    Math.sin(finalPitch),
    -Math.cos(finalYaw) * Math.cos(finalPitch),
  )
}
