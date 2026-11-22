import type { Sightline } from '../auditoriums/geometry'
import { calculateSightline } from '../auditoriums/geometry'
import type { VieShowArchivedLayout } from '../cinemas/vieshow-seat-archive'
import {
  defaultVieShowPreviewParameters,
  deriveVieShowPreviewGeometry,
  type VieShowPreviewGeometry,
  type VieShowPreviewParameters,
} from './vieshow-approximate-scene'

export type SightlineSamplePosition =
  'front-centre' | 'middle-centre' | 'rear-centre' | 'left-edge' | 'right-edge'

export type SensitivityScenario =
  'default' | 'closer-steeper' | 'further-flatter' | 'wider-block' | 'narrower-block'

export interface SampleScenarioResult {
  scenario: SensitivityScenario
  /** Simulated quantities, never surveyed seat-to-screen measurements. */
  sightline: Sightline
}

export interface GeometryAuditSample {
  position: SightlineSamplePosition
  /** Exact original public-booking seat label, not a fabricated row/number. */
  seatId: string
  scenarios: SampleScenarioResult[]
  /**
   * These extrema describe ONLY the explicitly chosen illustration scenarios.
   * They are not confidence bounds or a prediction of real-world uncertainty.
   */
  scenarioExtrema: {
    minHorizontalAngle: number
    maxHorizontalAngle: number
    minVerticalAngle: number
    maxVerticalAngle: number
  }
}

export interface VieShowGeometryAudit {
  cinemaSlug: string
  layoutId: string
  hallLabel: string
  observedAt: string
  layoutSource: string
  seatCount: number
  publishedCapacityComparison: VieShowArchivedLayout['countComparison']
  screenDimensionsSource: VieShowPreviewGeometry['screenDimensionsProvenance']
  screenDimensionsSourceUrl: string | null
  /** Existing screen spec associations rely on capacity cross-reference, not a certified plan. */
  screenToNumberedHallIdentity: 'capacity-only' | 'no-screen-specification'
  seatGridSource: 'operator-public-booking-preview'
  measuredSeatSpacing: false
  measuredRowSpacing: false
  measuredRowRise: false
  measuredScreenToFrontRowDistance: false
  fullyMeasured3D: false
  samples: GeometryAuditSample[]
}

const simulationScenarios: ReadonlyArray<{
  id: SensitivityScenario
  assumptions: Readonly<VieShowPreviewParameters>
}> = [
  { id: 'default', assumptions: defaultVieShowPreviewParameters },
  {
    id: 'closer-steeper',
    assumptions: {
      ...defaultVieShowPreviewParameters,
      frontDistanceM: 3.5,
      rowSpacingM: 0.9,
      rowRiseM: 0.26,
    },
  },
  {
    id: 'further-flatter',
    assumptions: {
      ...defaultVieShowPreviewParameters,
      frontDistanceM: 9,
      rowSpacingM: 1.25,
      rowRiseM: 0.1,
    },
  },
  {
    id: 'wider-block',
    assumptions: {
      ...defaultVieShowPreviewParameters,
      seatSpacingM: 0.84,
      screenToSeatBlockWidthRatio: 0.65,
    },
  },
  {
    id: 'narrower-block',
    assumptions: {
      ...defaultVieShowPreviewParameters,
      seatSpacingM: 0.54,
      screenToSeatBlockWidthRatio: 1.15,
    },
  },
] as const

/** Report the actual uncertainty from adjustable assumptions without making up venue surveys. */
export function auditVieShowHallGeometry(
  cinemaSlug: string,
  layout: VieShowArchivedLayout,
): VieShowGeometryAudit {
  const geometry = deriveVieShowPreviewGeometry(cinemaSlug, layout)
  const rows = [...new Set(geometry.seats.map((seat) => seat.z))].sort((a, b) => a - b)
  if (!rows.length) throw new Error('Cannot audit an auditorium without sourced seat positions')
  const centreSeatInRow = (z: number): string => {
    const candidates = geometry.seats
      .filter((seat) => seat.z === z)
      .sort((a, b) => Math.abs(a.x) - Math.abs(b.x) || a.id.localeCompare(b.id))
    if (!candidates.length) throw new Error('Missing seating row in audit')
    return candidates[0]!.id
  }
  const leftSeat = [...geometry.seats].sort((a, b) => a.x - b.x || a.id.localeCompare(b.id))[0]!
  const rightSeat = [...geometry.seats].sort((a, b) => b.x - a.x || a.id.localeCompare(b.id))[0]!
  const targets: Array<[SightlineSamplePosition, string]> = [
    ['front-centre', centreSeatInRow(rows[0]!)],
    ['middle-centre', centreSeatInRow(rows[Math.floor(rows.length / 2)]!)],
    ['rear-centre', centreSeatInRow(rows[rows.length - 1]!)],
    ['left-edge', leftSeat.id],
    ['right-edge', rightSeat.id],
  ]

  const scened = simulationScenarios.map(({ id, assumptions }) => {
    const scene = deriveVieShowPreviewGeometry(cinemaSlug, layout, { ...assumptions })
    if (
      scene.seats.length !== layout.ordinarySeatCount ||
      scene.screenDimensionsProvenance !== geometry.screenDimensionsProvenance ||
      scene.seatPositionsProvenance !== geometry.seatPositionsProvenance ||
      scene.screenSpecification?.dimensionSourceUrl !==
        geometry.screenSpecification?.dimensionSourceUrl ||
      (geometry.screenSpecification !== undefined &&
        (scene.auditorium.screen.width !== geometry.auditorium.screen.width ||
          scene.auditorium.screen.height !== geometry.auditorium.screen.height))
    ) {
      throw new Error('Sensitivity scenario changed sourced auditorium evidence')
    }
    return {
      id,
      screen: scene.auditorium.screen,
      seats: new Map(scene.seats.map((seat) => [seat.id, seat])),
    }
  })

  const samples: GeometryAuditSample[] = targets.map(([position, seatId]) => {
    const scenarios: SampleScenarioResult[] = scened.map((variant) => {
      const seat = variant.seats.get(seatId)
      if (!seat) throw new Error('Sensitivity scenario lost a sourced seat')
      const sightline = calculateSightline(seat, variant.screen)
      if (!Object.values(sightline).every(Number.isFinite) || sightline.horizontalAngle <= 0) {
        throw new Error('Sensitivity scenario generated an invalid sightline')
      }
      return { scenario: variant.id, sightline }
    })
    const horizontal = scenarios.map((item) => item.sightline.horizontalAngle)
    const vertical = scenarios.map((item) => item.sightline.verticalAngle)
    return {
      position,
      seatId,
      scenarios,
      scenarioExtrema: {
        minHorizontalAngle: Math.min(...horizontal),
        maxHorizontalAngle: Math.max(...horizontal),
        minVerticalAngle: Math.min(...vertical),
        maxVerticalAngle: Math.max(...vertical),
      },
    }
  })
  return {
    cinemaSlug,
    layoutId: layout.id,
    hallLabel: layout.hallLabel,
    observedAt: layout.observedAt,
    layoutSource: layout.snapshotSource,
    seatCount: layout.ordinarySeatCount,
    publishedCapacityComparison: layout.countComparison,
    screenDimensionsSource: geometry.screenDimensionsProvenance,
    screenDimensionsSourceUrl: geometry.screenSpecification?.dimensionSourceUrl ?? null,
    screenToNumberedHallIdentity: geometry.screenSpecification
      ? 'capacity-only'
      : 'no-screen-specification',
    seatGridSource: geometry.seatPositionsProvenance,
    measuredSeatSpacing: false,
    measuredRowSpacing: false,
    measuredRowRise: false,
    measuredScreenToFrontRowDistance: false,
    fullyMeasured3D: false,
    samples,
  }
}
