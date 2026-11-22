/**
 * Conceptual model defaults, not measurements of an actual auditorium.
 * Sharing these constants prevents the 2D diagram and 3D estimate drifting
 * apart. Individual hall dimensions override only when independently sourced.
 */
export const DEFAULT_SCREEN_TO_SEAT_BLOCK_RATIO = 0.86

/** The preferred immersive seat-screen viewing lens, not a calibrated human eye. */
export const DEFAULT_ESTIMATED_SEAT_POV_HORIZONTAL_FOV = 65
