import {
  isReferenceSpecialSeat,
  type OfficialSeatLayoutReference,
} from '../cinemas/official-seat-layouts'
import {
  defaultSourcedGridParameters,
  deriveSourcedGridScene,
  initialSourcedGridSeat,
  type SourcedGridParameters,
  type SourcedGridPreview,
  type SourcedGridSpecialPosition,
  type SourcedGridPosition,
} from './sourced-grid-scene'

export interface MiranewPreviewGeometry extends SourcedGridPreview {
  /** SeatView identifies the TYPE of screen, but not a permanent numbered hall. */
  physicalHallNumber: null
  screenDimensionsProvenance: 'estimated'
  seatPositionsProvenance: 'operator-public-booking-preview'
  seatPatternId: string
}

/**
 * All real seat labels and two-dimensional cells come from the archived public
 * Miranew SeatView. A published count or an IMAX type must never generate
 * regular seats, imply a physical hall number, or substitute a screen size.
 */
export function deriveMiranewPreviewGeometry(
  reference: OfficialSeatLayoutReference,
  parameters: SourcedGridParameters = { ...defaultSourcedGridParameters },
): MiranewPreviewGeometry {
  if (reference.physicalHallNumber !== null) {
    throw new Error('A Miranew observed pattern must not claim a permanent hall assignment')
  }
  const seats: SourcedGridPosition[] = []
  const specialPositions: SourcedGridSpecialPosition[] = []
  for (const [label, gridRow, gridColumn] of reference.seatPositions) {
    if (isReferenceSpecialSeat(label)) {
      specialPositions.push([gridRow, gridColumn])
    } else {
      seats.push([label, gridRow, gridColumn])
    }
  }
  if (
    reference.totalSeatLabels !== reference.seatPositions.length ||
    specialPositions.length !== reference.accessibleSeatLabels
  ) {
    throw new Error('Observed Miranew seat grid and accessibility markers disagree')
  }
  if (!seats.length) {
    throw new Error('An accessible-only grid cannot imply ordinary selectable seats')
  }
  const scene = deriveSourcedGridScene({ id: reference.id, seats, specialPositions }, parameters)
  return {
    ...scene,
    physicalHallNumber: null,
    screenDimensionsProvenance: 'estimated',
    seatPositionsProvenance: 'operator-public-booking-preview',
    seatPatternId: reference.id,
  }
}

export function initialMiranewPreviewSeat(geometry: MiranewPreviewGeometry): string {
  return initialSourcedGridSeat(geometry)
}
