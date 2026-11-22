import { Vector3 } from 'three'
import type { AuditoriumSeat } from '../auditoriums/geometry'
import type { ScreenDefinition } from '../auditoriums/schema'
import type { CinemaRoomLayout } from './cinema-room-layout'

export type CinemaViewMode = 'seat' | 'overview'

/** A modelled head pose, not a measured viewer's head angle. */
export type CinemaEyeAim = 'eye-level' | 'screen-centre'
/** Default viewing pose used for judging a seat; level gaze is an opt-in reference. */
export const DEFAULT_CINEMA_EYE_AIM: CinemaEyeAim = 'screen-centre'

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

/**
 * The head movement a viewer would need to face the screen centre.
 * Positive vertical = looking up; positive horizontal = turning right.
 * These are estimates when the cinema layout/rake is not surveyed.
 */
export function cinemaScreenCentreGazeAngles(
  seat: Pick<AuditoriumSeat, 'x' | 'z' | 'eyeY'>,
  screen: Pick<ScreenDefinition, 'centerX' | 'bottomY' | 'height' | 'z'>,
): { verticalDegrees: number; horizontalDegrees: number } {
  const forward = seat.z - screen.z
  if (!Number.isFinite(forward) || forward <= 0) {
    throw new RangeError('Screen centre must be ahead of the selected seat')
  }
  const lateral = screen.centerX - seat.x
  const vertical = screen.bottomY + screen.height / 2 - seat.eyeY
  const toDegrees = 180 / Math.PI
  return {
    verticalDegrees: Math.atan2(vertical, Math.hypot(forward, lateral)) * toDegrees,
    horizontalDegrees: Math.atan2(lateral, forward) * toDegrees,
  }
}

/** Preserve world-up when rotating far behind the seat (no camera roll). */
export function cinemaCameraDirection(
  position: Vector3,
  target: Vector3,
  yaw: number,
  pitch: number,
  aim: CinemaEyeAim = 'screen-centre',
): Vector3 {
  const delta = target.clone().sub(position)
  const baseYaw = Math.atan2(delta.x, -delta.z)
  // Head pointing to the screen is not the same as a natural horizontal gaze.
  // Keep the actual eye position for BOTH modes; only camera orientation varies.
  const basePitch = aim === 'eye-level' ? 0 : Math.atan2(delta.y, Math.hypot(delta.x, delta.z))
  const finalYaw = baseYaw + yaw
  const finalPitch = Math.max(-1.25, Math.min(1.25, basePitch + pitch))
  return new Vector3(
    Math.sin(finalYaw) * Math.cos(finalPitch),
    Math.sin(finalPitch),
    -Math.cos(finalYaw) * Math.cos(finalPitch),
  )
}
