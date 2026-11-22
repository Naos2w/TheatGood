import type { AuditoriumSeat } from '../auditoriums/geometry'
import type { CinemaSceneModel } from './cinema-scene-model'
import type { OfficialSeatLayoutReference } from '../cinemas/official-seat-layouts'
import {
  calculateVieShowProportionalCalibration,
  defaultVieShowPreviewParameters,
} from './vieshow-approximate-scene'

export interface MiranewObservedPatternScene extends CinemaSceneModel {
  sourceIdentity: 'operator-public-layout-pattern-without-physical-hall-number'
  physicalHallNumber: null
  geometryMeasured: false
  screenDimensionsProvenance: 'estimated'
  seatGridProvenance: 'public-operator-booking-preview'
  wheelchairPositionsIndependentlyVerified: false
}

export function deriveMiranewPattern3D(
  reference: OfficialSeatLayoutReference,
): MiranewObservedPatternScene {
  if (reference.physicalHallNumber !== null) {
    throw new Error('Miranew source is a pattern, not a verified permanent hall number')
  }
  const columns = reference.seatPositions.map(([, , column]) => column)
  const rowNumbers = [...new Set(reference.seatPositions.map(([, row]) => row))].sort(
    (a, b) => a - b,
  )
  if (columns.length !== reference.totalSeatLabels || !rowNumbers.length) {
    throw new Error('Invalid observed operator seat pattern')
  }
  const left = Math.min(...columns)
  const right = Math.max(...columns)
  const centre = (left + right) / 2
  const pitch = calculateVieShowProportionalCalibration(
    right - left + 1,
    undefined,
    defaultVieShowPreviewParameters,
  )
  const params = defaultVieShowPreviewParameters
  const rows = rowNumbers.map((row) => ({
    label: String(row),
    z: params.frontDistanceM + (row - rowNumbers[0]!) * params.rowSpacingM,
    elevation: (row - rowNumbers[0]!) * params.rowRiseM,
  }))
  const seats: AuditoriumSeat[] = reference.seatPositions.map(([label, row, column], index) => {
    const elevation = (row - rowNumbers[0]!) * params.rowRiseM
    return {
      id: label,
      row: String(row),
      number: index + 1,
      x: (column - centre) * pitch.calculatedGridPitchM,
      z: params.frontDistanceM + (row - rowNumbers[0]!) * params.rowSpacingM,
      elevation,
      eyeY: elevation + 1.17,
    }
  })
  const width = Math.max(
    6.5,
    Math.min(23, pitch.estimatedSeatBlockWidthM * params.screenToSeatBlockWidthRatio),
  )
  return {
    auditorium: {
      id: 'miranew-observed-pattern-' + reference.id,
      screen: {
        width,
        height: width / 1.9,
        centerX: 0,
        bottomY: 1.3,
        z: 0,
      },
      seatWidth: pitch.calculatedGridPitchM * 0.85,
      rows,
    },
    seats,
    wheelchairSpots: [], // W-labelled public markers do not establish surveyed floor plans.
    sourceIdentity: 'operator-public-layout-pattern-without-physical-hall-number',
    physicalHallNumber: null,
    geometryMeasured: false,
    screenDimensionsProvenance: 'estimated',
    seatGridProvenance: 'public-operator-booking-preview',
    wheelchairPositionsIndependentlyVerified: false,
  }
}

export function initialMiranewPatternSeat(scene: MiranewObservedPatternScene): string {
  const sortedRows = [...new Set(scene.seats.map((seat) => seat.z))].sort((a, b) => a - b)
  const centre = sortedRows[Math.floor(sortedRows.length / 2)]!
  return [...scene.seats].sort(
    (a, b) =>
      Math.abs(a.z - centre) - Math.abs(b.z - centre) ||
      Math.abs(a.x) - Math.abs(b.x) ||
      a.id.localeCompare(b.id),
  )[0]!.id
}
