import type { VieShowArchivedLayout } from '../cinemas/vieshow-seat-archive'

/** Shared public source fields required to construct original 2D/3D views. */
export type PublicSourceHallLayout = Pick<
  VieShowArchivedLayout,
  | 'id'
  | 'hallLabel'
  | 'hallNumber'
  | 'seatPositions'
  | 'wheelchairPositions'
  | 'ordinarySeatCount'
  | 'gridRows'
  | 'gridColumns'
>
import {
  vieShowScreenSpecification,
  type VieShowScreenSpecification,
} from '../cinemas/vieshow-screen-specs'
import {
  calculateSourcedGridCalibration,
  defaultSourcedGridParameters,
  deriveSourcedGridScene,
  initialSourcedGridSeat,
  type SourcedGridParameters,
  type SourcedGridPreview,
  type SourcedGridProportionalCalibration,
} from './sourced-grid-scene'
export type { SceneAuditoriumGeometry } from './cinema-scene-model'

/** The Vie Show adapter shares the same ratio-based geometry engine as other chains. */
export type VieShowPreviewParameters = SourcedGridParameters
export const defaultVieShowPreviewParameters: Readonly<VieShowPreviewParameters> =
  defaultSourcedGridParameters
export type VieShowProportionalCalibration = SourcedGridProportionalCalibration
export const calculateVieShowProportionalCalibration = calculateSourcedGridCalibration

export interface VieShowPreviewGeometry extends SourcedGridPreview {
  screenSpecification?: VieShowScreenSpecification
  screenDimensionsProvenance: 'operator-published' | 'independent-secondary' | 'estimated'
  seatPositionsProvenance: 'operator-public-booking-preview'
}

/**
 * Only archived operator-booking labels and grid cells are sourced. Absolute
 * positions remain proportional estimates; screen specifications stay
 * opt-in when paired with hall-specific traceable data.
 */
export function deriveVieShowPreviewGeometry(
  cinemaSlug: string,
  layout: PublicSourceHallLayout,
  params: VieShowPreviewParameters = { ...defaultVieShowPreviewParameters },
): VieShowPreviewGeometry {
  if (layout.gridRows < 1 || layout.gridColumns < 1) {
    throw new Error('Cannot simulate a hall without a public seat grid')
  }
  const screenSpecification = vieShowScreenSpecification(cinemaSlug, layout)
  const scene = deriveSourcedGridScene(
    {
      id: layout.id,
      seats: layout.seatPositions,
      specialPositions: layout.wheelchairPositions,
      screenWidthM: screenSpecification?.screenWidthM,
      screenHeightM: screenSpecification?.screenHeightM,
    },
    params,
  )
  return {
    ...scene,
    auditorium: {
      ...scene.auditorium,
      // Preserve the stable model identity of existing archived Vie Show links.
      id:
        (cinemaSlug.startsWith('centuryasia-')
          ? 'centuryasia-preview-'
          : cinemaSlug.startsWith('broadway-')
            ? 'broadway-preview-'
            : 'vieshow-preview-') + layout.id,
    },
    screenSpecification,
    screenDimensionsProvenance: screenSpecification?.dimensionSource ?? 'estimated',
    seatPositionsProvenance: 'operator-public-booking-preview',
  }
}

export function initialVieShowPreviewSeat(geometry: VieShowPreviewGeometry): string {
  return initialSourcedGridSeat(geometry)
}
