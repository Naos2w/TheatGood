import type { AuditoriumSeat } from '../auditoriums/geometry'
import type { ScreenDefinition } from '../auditoriums/schema'
import type { VieShowArchivedLayout } from '../cinemas/vieshow-seat-archive'
import {
  vieShowScreenSpecification,
  type VieShowScreenSpecification,
} from '../cinemas/vieshow-screen-specs'

/**
 * These are configurable visual assumptions, NOT dimensions surveyed in the
 * theatre. Actual observed facts remain seat ID and row/column grid indices.
 */
export interface VieShowPreviewParameters {
  seatSpacingM: number
  rowSpacingM: number
  rowRiseM: number
  frontDistanceM: number
  estimatedScreenScale: number
}

export const defaultVieShowPreviewParameters: Readonly<VieShowPreviewParameters> = {
  seatSpacingM: 0.66,
  rowSpacingM: 1.04,
  rowRiseM: 0.16,
  frontDistanceM: 5,
  estimatedScreenScale: 1,
}

export interface SceneAuditoriumGeometry {
  id: string
  screen: ScreenDefinition
  seatWidth: number
  rows: { label: string; z: number; elevation: number }[]
}

export interface VieShowPreviewGeometry {
  auditorium: SceneAuditoriumGeometry
  seats: AuditoriumSeat[]
  wheelchairSpots: { x: number; z: number; elevation: number }[]
  screenSpecification?: VieShowScreenSpecification
  screenDimensionsProvenance: 'operator-published' | 'independent-secondary' | 'estimated'
  seatPositionsProvenance: 'operator-public-booking-preview'
  /** Width of the occupied seat grid used to derive the estimated screen. */
  occupiedColumns: number
}

function assertParameter(value: number, min: number, max: number, label: string): void {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError('Invalid visual estimate: ' + label)
  }
}

export function deriveVieShowPreviewGeometry(
  cinemaSlug: string,
  layout: VieShowArchivedLayout,
  params: VieShowPreviewParameters = { ...defaultVieShowPreviewParameters },
): VieShowPreviewGeometry {
  assertParameter(params.seatSpacingM, 0.48, 0.95, 'seat spacing')
  assertParameter(params.rowSpacingM, 0.75, 1.8, 'row spacing')
  assertParameter(params.rowRiseM, 0.05, 0.4, 'row rise')
  assertParameter(params.frontDistanceM, 2.5, 12, 'front-row distance')
  assertParameter(params.estimatedScreenScale, 0.65, 1.5, 'screen scale')
  if (layout.seatPositions.length === 0 || layout.gridRows < 1 || layout.gridColumns < 1) {
    throw new Error('Cannot simulate a hall without a public seat grid')
  }

  const columns = [
    ...layout.seatPositions.map((seat) => seat[2]),
    ...layout.wheelchairPositions.map((seat) => seat[1]),
  ]
  const left = Math.min(...columns)
  const right = Math.max(...columns)
  const centre = (left + right) / 2
  const occupiedColumns = right - left + 1
  const allRows = [...new Set(layout.seatPositions.map((seat) => seat[1]))].sort((a, b) => a - b)
  const rows = allRows.map((row) => ({
    label: String(row),
    z: params.frontDistanceM + (row - allRows[0]!) * params.rowSpacingM,
    elevation: (row - allRows[0]!) * params.rowRiseM,
  }))
  const rowsByIndex = new Map(allRows.map((row, index) => [row, rows[index]!]))

  const seats: AuditoriumSeat[] = layout.seatPositions.map(([label, row, column], index) => {
    const layoutRow = rowsByIndex.get(row)!
    return {
      id: label,
      // Physical grid row, not an invented A/B row for numeric-only seat IDs.
      row: String(row),
      number: index + 1,
      x: (column - centre) * params.seatSpacingM,
      z: layoutRow.z,
      elevation: layoutRow.elevation,
      eyeY: layoutRow.elevation + 1.17,
    }
  })

  const wheelchairSpots = layout.wheelchairPositions.map(([row, column]) => ({
    x: (column - centre) * params.seatSpacingM,
    z: params.frontDistanceM + (row - allRows[0]!) * params.rowSpacingM,
    elevation: (row - allRows[0]!) * params.rowRiseM,
  }))

  const screenSpecification = vieShowScreenSpecification(cinemaSlug, layout)
  const estimatedScreenWidthM = Math.max(
    6.5,
    Math.min(23, occupiedColumns * params.seatSpacingM * 0.86 * params.estimatedScreenScale),
  )
  const screenWidth = screenSpecification?.screenWidthM ?? estimatedScreenWidthM
  const screenHeight = screenSpecification?.screenHeightM ?? estimatedScreenWidthM / 1.9
  const screen: ScreenDefinition = {
    width: screenWidth,
    height: screenHeight,
    centerX: 0,
    bottomY: 1.3,
    z: 0,
  }

  return {
    auditorium: {
      id: 'vieshow-preview-' + layout.id,
      screen,
      seatWidth: params.seatSpacingM * 0.85,
      rows,
    },
    seats,
    wheelchairSpots,
    screenSpecification,
    screenDimensionsProvenance: screenSpecification?.dimensionSource ?? 'estimated',
    seatPositionsProvenance: 'operator-public-booking-preview',
    occupiedColumns,
  }
}

/** Default to a central seat in the middle third, not a fabricated recommendation. */
export function initialVieShowPreviewSeat(geometry: VieShowPreviewGeometry): string {
  const seats = geometry.seats
  if (!seats.length) throw new Error('Cannot select a seat in an empty layout')
  const rows = [...new Set(seats.map((seat) => seat.z))].sort((a, b) => a - b)
  const desiredZ = rows[Math.floor(rows.length / 2)]!
  return [...seats].sort(
    (a, b) =>
      Math.abs(a.z - desiredZ) - Math.abs(b.z - desiredZ) ||
      Math.abs(a.x) - Math.abs(b.x) ||
      a.id.localeCompare(b.id),
  )[0]!.id
}
