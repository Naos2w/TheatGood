import type { AuditoriumSeat } from '../auditoriums/geometry'
import type { ScreenDefinition } from '../auditoriums/schema'

/**
 * Shared, brand-independent renderer input. Every seat remains a sourced label
 * and a position in metres (Y up, screen towards negative Z).
 * The input itself makes no claim that the physical geometry was measured.
 */
export interface SceneAuditoriumGeometry {
  id: string
  screen: ScreenDefinition
  seatWidth: number
  rows: { label: string; z: number; elevation: number }[]
}

export interface CinemaWheelchairSpot {
  x: number
  z: number
  elevation: number
}

export interface CinemaSceneModel {
  auditorium: SceneAuditoriumGeometry
  seats: AuditoriumSeat[]
  wheelchairSpots: CinemaWheelchairSpot[]
}

/** Geometry confidence is supplied by each source adapter, never inferred from rendering. */
export type CinemaGeometryConfidence = 'measured' | 'partly-measured' | 'estimated'
