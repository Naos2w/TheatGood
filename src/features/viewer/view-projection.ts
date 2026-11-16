/**
 * A perspective camera's fov is vertical. Keep the chosen HORIZONTAL angular
 * field stable when switching between landscape and portrait screens.
 *
 * The resulting screen pixels are a projection, not a 1:1 physical experience:
 * matching a real-world view requires calibrating the viewer's device size and
 * viewing distance. Auditorium measurements remain independently sourced.
 */
export function verticalFovFromHorizontal(horizontalDegrees: number, aspect: number): number {
  if (
    !Number.isFinite(horizontalDegrees) ||
    horizontalDegrees <= 0 ||
    horizontalDegrees >= 170 ||
    !Number.isFinite(aspect) ||
    aspect <= 0
  ) {
    throw new RangeError('Horizontal field of view and viewport aspect must be valid')
  }
  const halfAngle = (horizontalDegrees * Math.PI) / 360
  return (360 / Math.PI) * Math.atan(Math.tan(halfAngle) / aspect)
}

export function horizontalFovFromVertical(verticalDegrees: number, aspect: number): number {
  if (
    !Number.isFinite(verticalDegrees) ||
    verticalDegrees <= 0 ||
    verticalDegrees >= 180 ||
    !Number.isFinite(aspect) ||
    aspect <= 0
  ) {
    throw new RangeError('Vertical field of view and viewport aspect must be valid')
  }
  return (360 / Math.PI) * Math.atan(aspect * Math.tan((verticalDegrees * Math.PI) / 360))
}

/** Deliberate user-controlled perspective presets; not measured camera lenses. */
export const horizontalFovPresets = [65, 80, 95] as const
export type HorizontalFovPreset = (typeof horizontalFovPresets)[number]
