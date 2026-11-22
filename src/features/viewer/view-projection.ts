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

/**
 * Device-aware framing for the same physical cinema geometry.
 *
 * Perspective naturally has a vertical field that depends on CSS viewport
 * aspect ratio. Portrait devices cannot show a wide cinema screen at the
 * same apparent scale without cropping: cap the extreme fisheye-like view
 * instead of shrinking the physical screen, row positions or eye height.
 *
 * On ultrawide monitors avoid a very tight vertical crop by expanding the
 * horizontal view a little; these remain illustrative virtual camera
 * choices and NOT a calibrated human visual field.
 */
export function responsiveCinemaFov(
  horizontalDegrees: number,
  viewportWidth: number,
  viewportHeight: number,
): {
  aspect: number
  verticalDegrees: number
  effectiveHorizontalDegrees: number
  portraitSideCrop: boolean
} {
  if (
    !Number.isFinite(viewportWidth) ||
    !Number.isFinite(viewportHeight) ||
    viewportWidth <= 0 ||
    viewportHeight <= 0
  ) {
    throw new RangeError('Camera viewport dimensions must be positive and finite')
  }
  const aspect = viewportWidth / viewportHeight
  const originalVertical = verticalFovFromHorizontal(horizontalDegrees, aspect)
  // Limit extreme vertical distortion on tall phones and tablets.
  const portraitCap = aspect < 1 ? 78 : originalVertical
  // Wide displays otherwise overfill their short height with giant screens.
  const wideMinimum = aspect > 2 ? Math.min(42, verticalFovFromHorizontal(110, aspect)) : 0
  const verticalDegrees = Math.max(wideMinimum, Math.min(originalVertical, portraitCap))
  const effectiveHorizontalDegrees = horizontalFovFromVertical(verticalDegrees, aspect)
  return {
    aspect,
    verticalDegrees,
    effectiveHorizontalDegrees,
    portraitSideCrop: aspect < 1 && verticalDegrees < originalVertical - 0.001,
  }
}

/** Deliberate user-controlled perspective presets; not measured camera lenses. */
export const horizontalFovPresets = [65, 80, 95] as const
export type HorizontalFovPreset = (typeof horizontalFovPresets)[number]
