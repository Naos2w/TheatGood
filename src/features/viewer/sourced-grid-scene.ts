import type { AuditoriumSeat } from '../auditoriums/geometry'
import type { ScreenDefinition } from '../auditoriums/schema'
import { DEFAULT_SCREEN_TO_SEAT_BLOCK_RATIO } from '../cinemas/seat-screen-assumptions'
import type { CinemaSceneModel } from './cinema-scene-model'

/**
 * Shared geometry assumptions used for sourced booking grids from EVERY chain.
 * Grid cells and printed seat IDs are observed; metres/row rake are estimates.
 */
export interface SourcedGridParameters {
  seatSpacingM: number
  screenToSeatBlockWidthRatio: number
  rowSpacingM: number
  rowRiseM: number
  frontDistanceM: number
  estimatedScreenScale: number
}

export const defaultSourcedGridParameters: Readonly<SourcedGridParameters> = {
  seatSpacingM: 0.66,
  screenToSeatBlockWidthRatio: DEFAULT_SCREEN_TO_SEAT_BLOCK_RATIO,
  rowSpacingM: 1.04,
  rowRiseM: 0.16,
  frontDistanceM: 5,
  estimatedScreenScale: 1,
}

export interface SourcedGridProportionalCalibration {
  /** Only a referenced screen width makes the transverse metric scale traceable. */
  method: 'known-screen-width' | 'grid-only-estimate'
  screenToSeatBlockWidthRatio: number
  occupiedColumns: number
  calculatedGridPitchM: number
  estimatedSeatBlockWidthM: number
  ratioVerifiedAgainstScaledFloorPlan: false
}

export type SourcedGridPosition = readonly [label: string, gridRow: number, gridColumn: number]
export type SourcedGridSpecialPosition = readonly [gridRow: number, gridColumn: number]

export interface SourcedGridInput {
  /** Distinct source layout key; never an inferred permanent physical hall number. */
  id: string
  seats: readonly SourcedGridPosition[]
  /** Wheelchair/accessible markers are NOT ordinary selectable seats. */
  specialPositions?: readonly SourcedGridSpecialPosition[]
  /** Screen values must come from an auditorium-specific cited source or stay undefined. */
  screenWidthM?: number
  screenHeightM?: number
}

export interface SourcedGridPreview extends CinemaSceneModel {
  calibration: SourcedGridProportionalCalibration
  occupiedColumns: number
}

function assertParameter(value: number, min: number, max: number, label: string): void {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError('Invalid visual estimate: ' + label)
  }
}

/** Operator booking cells are not a measured architectural plan. */
export function calculateSourcedGridCalibration(
  occupiedColumns: number,
  referenceScreenWidthM: number | undefined,
  params: Pick<SourcedGridParameters, 'seatSpacingM' | 'screenToSeatBlockWidthRatio'>,
): SourcedGridProportionalCalibration {
  assertParameter(occupiedColumns, 1, 150, 'occupied columns')
  assertParameter(params.seatSpacingM, 0.48, 0.95, 'seat spacing')
  assertParameter(params.screenToSeatBlockWidthRatio, 0.55, 1.35, 'screen/seating ratio')
  if (referenceScreenWidthM !== undefined) {
    assertParameter(referenceScreenWidthM, 1, 70, 'screen width')
  }
  const calculatedGridPitchM =
    referenceScreenWidthM === undefined
      ? params.seatSpacingM
      : referenceScreenWidthM / (occupiedColumns * params.screenToSeatBlockWidthRatio)
  return {
    method: referenceScreenWidthM === undefined ? 'grid-only-estimate' : 'known-screen-width',
    screenToSeatBlockWidthRatio: params.screenToSeatBlockWidthRatio,
    occupiedColumns,
    calculatedGridPitchM,
    estimatedSeatBlockWidthM: calculatedGridPitchM * occupiedColumns,
    ratioVerifiedAgainstScaledFloorPlan: false,
  }
}

/**
 * One shared 2D grid -> 3D coordinate system. No empty seats, fake numbered
 * halls or fabricated aisle seats are ever generated. Existing W markers keep
 * their own visual positions and cannot enter the regular seat selection.
 */
export function deriveSourcedGridScene(
  input: SourcedGridInput,
  params: SourcedGridParameters = { ...defaultSourcedGridParameters },
): SourcedGridPreview {
  assertParameter(params.seatSpacingM, 0.48, 0.95, 'seat spacing')
  assertParameter(params.rowSpacingM, 0.75, 1.8, 'row spacing')
  assertParameter(params.rowRiseM, 0.05, 0.4, 'row rise')
  assertParameter(params.frontDistanceM, 2.5, 12, 'front-row distance')
  assertParameter(params.estimatedScreenScale, 0.65, 1.5, 'screen scale')
  if (!input.id.trim() || !input.seats.length) {
    throw new Error('Cannot simulate an auditorium without sourced seat positions and identity')
  }
  if ((input.screenWidthM === undefined) !== (input.screenHeightM === undefined)) {
    throw new Error('A known screen requires sourced width AND height')
  }
  if (input.screenHeightM !== undefined) {
    assertParameter(input.screenHeightM, 1, 50, 'screen height')
  }

  const ids = new Set<string>()
  const occupied = new Set<string>()
  const allPositions = [
    ...input.seats.map(([, row, column]) => [row, column] as const),
    ...(input.specialPositions ?? []),
  ]
  for (const [label, row, column] of input.seats) {
    if (!label.trim() || ids.has(label)) throw new Error('Duplicate or missing sourced seat ID')
    ids.add(label)
    if (!Number.isInteger(row) || !Number.isInteger(column) || row < 1 || column < 1) {
      throw new Error('Invalid sourced grid coordinate')
    }
  }
  for (const [row, column] of allPositions) {
    if (!Number.isInteger(row) || !Number.isInteger(column) || row < 1 || column < 1) {
      throw new Error('Invalid sourced grid coordinate')
    }
    const gridCell = row + '/' + column
    if (occupied.has(gridCell)) throw new Error('Duplicate sourced grid position')
    occupied.add(gridCell)
  }

  const columns = allPositions.map(([, column]) => column)
  const left = Math.min(...columns)
  const right = Math.max(...columns)
  const centre = (left + right) / 2
  const occupiedColumns = right - left + 1
  const calibration = calculateSourcedGridCalibration(occupiedColumns, input.screenWidthM, params)
  const pitch = calibration.calculatedGridPitchM

  // Compare the physical source row indices; blank source grid rows must stay
  // blank instead of compressing the distance to the following row.
  const allRows = [...new Set(input.seats.map((seat) => seat[1]))].sort((a, b) => a - b)
  const firstRow = allRows[0]!
  const rows = allRows.map((sourceRow) => ({
    label: String(sourceRow),
    z: params.frontDistanceM + (sourceRow - firstRow) * params.rowSpacingM,
    elevation: (sourceRow - firstRow) * params.rowRiseM,
  }))
  const rowByIndex = new Map(allRows.map((sourceRow, index) => [sourceRow, rows[index]!]))
  const seats: AuditoriumSeat[] = input.seats.map(([label, row, column], index) => {
    const placement = rowByIndex.get(row)!
    return {
      id: label,
      row: String(row),
      number: index + 1,
      x: (column - centre) * pitch,
      z: placement.z,
      elevation: placement.elevation,
      eyeY: placement.elevation + 1.17,
    }
  })
  const wheelchairSpots = (input.specialPositions ?? []).map(([row, column]) => ({
    x: (column - centre) * pitch,
    z: params.frontDistanceM + (row - firstRow) * params.rowSpacingM,
    elevation: (row - firstRow) * params.rowRiseM,
  }))

  const estimatedScreenWidthM = Math.max(
    6.5,
    Math.min(
      23,
      calibration.estimatedSeatBlockWidthM *
        params.screenToSeatBlockWidthRatio *
        params.estimatedScreenScale,
    ),
  )
  const screen: ScreenDefinition = {
    width: input.screenWidthM ?? estimatedScreenWidthM,
    height: input.screenHeightM ?? estimatedScreenWidthM / 1.9,
    centerX: 0,
    bottomY: 1.3,
    z: 0,
  }

  return {
    auditorium: {
      id: 'sourced-grid-preview-' + input.id,
      screen,
      seatWidth: pitch * 0.85,
      rows,
    },
    seats,
    wheelchairSpots,
    calibration,
    occupiedColumns,
  }
}

/** Select only a truly observed seat in the model's middle rows. */
export function initialSourcedGridSeat(scene: Pick<SourcedGridPreview, 'seats'>): string {
  const seats = scene.seats
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
