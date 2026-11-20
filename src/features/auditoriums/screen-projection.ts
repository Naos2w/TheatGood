import type { ScreenDefinition } from './schema'

export interface ScreenProjection {
  centreY: number
  width: number
  height: number
  rotationX: number
  topY: number
  topZ: number
  bottomY: number
  bottomZ: number
}

/**
 * Project a film onto the physical screen without inventing a measured screen
 * shape. Unspecified tilt and aspect keep the existing full-screen rendering.
 *
 * Positive tilt turns the top edge towards audience seats (+Z).
 * Projection aspect only reduces the usable image rectangle; the surrounding
 * physical screen remains dark. No cropping or image stretching is required.
 */
export function deriveScreenProjection(screen: ScreenDefinition): ScreenProjection {
  if (
    ![screen.width, screen.height, screen.centerX, screen.bottomY, screen.z].every(
      Number.isFinite,
    ) ||
    screen.width <= 0 ||
    screen.height <= 0
  ) {
    throw new RangeError('Screen dimensions and position must be finite and positive')
  }

  const tiltDegrees = screen.tiltDegrees ?? 0
  const projectionAspectRatio = screen.projectionAspectRatio ?? screen.width / screen.height
  if (
    !Number.isFinite(tiltDegrees) ||
    Math.abs(tiltDegrees) > 30 ||
    !Number.isFinite(projectionAspectRatio) ||
    projectionAspectRatio <= 0
  ) {
    throw new RangeError('Invalid screen tilt or projected picture aspect')
  }

  const rotationX = (tiltDegrees * Math.PI) / 180
  const width = Math.min(screen.width, screen.height * projectionAspectRatio)
  const height = Math.min(screen.height, screen.width / projectionAspectRatio)
  const halfVertical = (height / 2) * Math.cos(rotationX)
  const halfDepth = (height / 2) * Math.sin(rotationX)
  const centreY = screen.bottomY + screen.height / 2

  return {
    centreY,
    width,
    height,
    rotationX,
    topY: centreY + halfVertical,
    topZ: screen.z + halfDepth,
    bottomY: centreY - halfVertical,
    bottomZ: screen.z - halfDepth,
  }
}
