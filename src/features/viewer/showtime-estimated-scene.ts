import { z } from 'zod'
import type { AuditoriumSeat } from '../auditoriums/geometry'
import type { CinemaSceneModel, SceneAuditoriumGeometry } from './cinema-scene-model'
import { chainCinemas } from '../cinemas/chain-directory'
import {
  calculateVieShowProportionalCalibration,
  defaultVieShowPreviewParameters,
  type VieShowPreviewParameters,
} from './vieshow-approximate-scene'

/**
 * A research seat grid is not a measured architectural drawing.
 *
 * Both 2026-11-18 source variants preserve the operator's CSS-relative
 * seats, but only the extension variant proves venue+hall on the same
 * individual screening card. Legacy UI captures must remain research-only
 * until independently matched to the correct venue and hall.
 *
 * This is a headless geometry adapter for the EXISTING ThreeCinemaScene.
 * It does not add a public route, import research files into production,
 * publish a hall, or infer measurements from any venue-wide advertisement.
 */
const seatSchema = z.object({
  label: z.string().regex(/^[A-Za-z0-9]+排[0-9]+號$/),
  rowLabel: z
    .string()
    .regex(/^[A-Za-z0-9]+$/)
    .optional(),
  seatNumber: z.number().int().min(1).max(500),
  gridRow: z.number().int().min(1).max(150),
  gridColumn: z.number().int().min(1).max(150),
})

const snapshotSchema = z.object({
  sourceType: z.enum([
    'authorised_authenticated_operator_ui_seat_preview',
    'showtime_authenticated_chrome_extension_read_only',
  ]),
  cinemaSlug: z.string().min(1),
  observedHallLabel: z.string().min(2),
  observedAt: z.string().datetime({ offset: true }),
  physicalHallIdentityStatus: z.string(),
  relativeGridUnit: z.string(),
  ordinarySeatCount: z.number().int().min(20).max(1000),
  rowsCount: z.number().int().min(1).max(150),
  seatPositions: z.array(seatSchema).min(20).max(1000),
  publicLandingUrl: z.string().url().optional(),
  sourceLandingUrl: z.string().url().optional(),
  sourceSessionCinemaName: z.string().optional(),
  venueMatchedOnIndividualSessionCard: z.boolean().optional(),
  venueVerificationMethod: z.string().optional(),
  sourceEvidence: z.string().optional(),
  sourceRawSha256: z.string().optional(),
  selectedSeats: z.literal(0),
  bookingActionPerformed: z.literal(false),
  soldOrAvailableStateRetained: z.literal(false),
  operatorImageCopied: z.literal(false),
})

export type ShowtimeSeatSnapshot = z.infer<typeof snapshotSchema>
export type ShowtimeGeometryEvidence = 'same-card-venue-and-hall' | 'legacy-hall-unconfirmed'

export interface ShowtimeEstimatedScene extends CinemaSceneModel {
  cinemaSlug: string
  hallLabel: string
  evidence: ShowtimeGeometryEvidence
  eligibleForPreview: boolean
  geometryMeasured: false
  screenDimensionsProvenance: 'estimated'
  rowSpacingProvenance: 'estimated'
  venueClaimUsedAsHallMeasurement: false
  observedAt: string
  operatorGridUnit: string
  /** Source lacks verified wheelchair coordinates; never invent them. */
  wheelchairSpots: []
  estimatedGridPitchM: number
  estimatedScreenToSeatBlockRatio: number
}

const knownShowtimeVenues = new Map(
  chainCinemas
    .filter((cinema) => cinema.brand === 'showtime')
    .map((cinema) => [cinema.slug, cinema.name]),
)

/** Refuse unknown halls, malformed grids, non-operator sources or side effects. */
export function parseShowtimeSeatSnapshot(
  input: unknown,
  expectedCinemaSlug?: string,
): { snapshot: ShowtimeSeatSnapshot; evidence: ShowtimeGeometryEvidence } {
  const snapshot = snapshotSchema.parse(input)
  const officialVenueName = knownShowtimeVenues.get(snapshot.cinemaSlug)
  if (!officialVenueName || (expectedCinemaSlug && snapshot.cinemaSlug !== expectedCinemaSlug)) {
    throw new Error('Unknown or incorrectly assigned Showtime cinema')
  }
  const url = new URL(snapshot.sourceLandingUrl ?? snapshot.publicLandingUrl ?? '')
  const approvedOrigins = ['https://www.showtimes.com.tw', 'https://showtimes.com.tw']
  if (!approvedOrigins.includes(url.origin)) {
    throw new Error('Showtime source must use the public operator website')
  }
  if (snapshot.ordinarySeatCount !== snapshot.seatPositions.length) {
    throw new Error('Published snapshot count disagrees with observed seats')
  }
  const labels = new Set<string>()
  const occupied = new Set<string>()
  const gridRows = new Set<number>()
  for (const seat of snapshot.seatPositions) {
    const key = seat.gridRow + '/' + seat.gridColumn
    const labelParts = /^([A-Za-z0-9]+)排([0-9]+)號$/.exec(seat.label)
    if (
      labels.has(seat.label) ||
      occupied.has(key) ||
      !labelParts ||
      (seat.rowLabel !== undefined && seat.rowLabel !== labelParts[1]) ||
      seat.seatNumber !== Number(labelParts[2])
    ) {
      throw new Error('Showtime grid contains an overlapping or misleading seat')
    }
    labels.add(seat.label)
    occupied.add(key)
    gridRows.add(seat.gridRow)
  }
  if (gridRows.size !== snapshot.rowsCount) {
    throw new Error('Showtime grid row count does not match its source')
  }

  const sameCard = snapshot.sourceType === 'showtime_authenticated_chrome_extension_read_only'
  if (sameCard) {
    if (
      snapshot.venueMatchedOnIndividualSessionCard !== true ||
      snapshot.sourceSessionCinemaName !== officialVenueName ||
      snapshot.venueVerificationMethod !== 'exact_venue_plus_hall_on_same_screening_card' ||
      snapshot.sourceEvidence !==
        'signed_in_operator_preview_with_same_screening_card_venue_verified' ||
      snapshot.physicalHallIdentityStatus !==
        'operator_screening_card_venue_and_hall_verified_not_surveyed' ||
      !/^[a-f0-9]{64}$/.test(snapshot.sourceRawSha256 ?? '')
    ) {
      throw new Error('The hall has no independently verified same-card venue evidence')
    }
  } else if (
    snapshot.physicalHallIdentityStatus !== 'operator_session_label_not_independently_verified'
  ) {
    throw new Error('Legacy Showtime source confidence cannot be promoted automatically')
  }
  return { snapshot, evidence: sameCard ? 'same-card-venue-and-hall' : 'legacy-hall-unconfirmed' }
}

/**
 * Convert operator DOM coordinates to a physically plausible *illustration*.
 * X follows original displayed columns, Z increases away from the screen,
 * Y increases by assumed step rise. Missing seats stay missing.
 *
 * Only use for model studies. The product-facing preview still requires an
 * approved design and an explicit, provenance-preserving data import.
 */
export function deriveShowtimeEstimatedScene(
  input: unknown,
  params: VieShowPreviewParameters = defaultVieShowPreviewParameters,
  expectedCinemaSlug?: string,
): ShowtimeEstimatedScene {
  const { snapshot, evidence } = parseShowtimeSeatSnapshot(input, expectedCinemaSlug)
  const estimate = (value: number, min: number, max: number, name: string) => {
    if (!Number.isFinite(value) || value < min || value > max) {
      throw new RangeError('Invalid estimated ' + name)
    }
  }
  estimate(params.rowSpacingM, 0.75, 1.8, 'row spacing')
  estimate(params.rowRiseM, 0.05, 0.4, 'row rise')
  estimate(params.frontDistanceM, 2.5, 12, 'front distance')
  estimate(params.estimatedScreenScale, 0.65, 1.5, 'screen scale')

  const cols = snapshot.seatPositions.map((seat) => seat.gridColumn)
  const left = Math.min(...cols)
  const right = Math.max(...cols)
  const centre = (left + right) / 2
  const occupiedColumns = right - left + 1
  const calibration = calculateVieShowProportionalCalibration(occupiedColumns, undefined, params)
  const pitch = calibration.calculatedGridPitchM
  const minRow = Math.min(...snapshot.seatPositions.map((seat) => seat.gridRow))
  const realGridRows = [...new Set(snapshot.seatPositions.map((seat) => seat.gridRow))].sort(
    (a, b) => a - b,
  )
  const rows = realGridRows.map((gridRow) => ({
    label: String(gridRow),
    z: params.frontDistanceM + (gridRow - minRow) * params.rowSpacingM,
    elevation: (gridRow - minRow) * params.rowRiseM,
  }))
  const seats: AuditoriumSeat[] = snapshot.seatPositions.map((seat) => {
    const elevation = (seat.gridRow - minRow) * params.rowRiseM
    return {
      id: seat.label,
      row: String(seat.gridRow),
      number: seat.seatNumber,
      x: (seat.gridColumn - centre) * pitch,
      z: params.frontDistanceM + (seat.gridRow - minRow) * params.rowSpacingM,
      elevation,
      eyeY: elevation + 1.17,
    }
  })

  const width = Math.max(
    6.5,
    Math.min(
      23,
      calibration.estimatedSeatBlockWidthM *
        params.screenToSeatBlockWidthRatio *
        params.estimatedScreenScale,
    ),
  )
  const auditorium: SceneAuditoriumGeometry = {
    id: 'showtime-estimated-' + snapshot.cinemaSlug + '-' + snapshot.observedHallLabel,
    screen: {
      width,
      height: width / 1.9,
      centerX: 0,
      bottomY: 1.3,
      z: 0,
    },
    seatWidth: pitch * 0.85,
    rows,
  }
  return {
    cinemaSlug: snapshot.cinemaSlug,
    hallLabel: snapshot.observedHallLabel,
    evidence,
    eligibleForPreview: evidence === 'same-card-venue-and-hall',
    geometryMeasured: false,
    screenDimensionsProvenance: 'estimated',
    rowSpacingProvenance: 'estimated',
    venueClaimUsedAsHallMeasurement: false,
    observedAt: snapshot.observedAt,
    operatorGridUnit: snapshot.relativeGridUnit,
    auditorium,
    seats,
    wheelchairSpots: [],
    estimatedGridPitchM: pitch,
    estimatedScreenToSeatBlockRatio: params.screenToSeatBlockWidthRatio,
  }
}
