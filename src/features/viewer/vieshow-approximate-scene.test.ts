import { describe, expect, it } from 'vitest'
import { loadVieShowArchiveForCinema } from '../cinemas/vieshow-seat-archive'
import { chainCinemas } from '../cinemas/chain-directory'
import {
  vieShowScreenSpecification,
  vieShowScreenSpecifications,
} from '../cinemas/vieshow-screen-specs'
import {
  defaultVieShowPreviewParameters,
  calculateVieShowProportionalCalibration,
  deriveVieShowPreviewGeometry,
  initialVieShowPreviewSeat,
} from './vieshow-approximate-scene'

describe('source-aware nationwide Vie Show 3D preview geometry', () => {
  it('derives a proportional horizontal grid using a known screen width and an explicitly unverified ratio', () => {
    const fromScreen = calculateVieShowProportionalCalibration(
      32,
      22,
      defaultVieShowPreviewParameters,
    )
    expect(fromScreen.method).toBe('known-screen-width')
    expect(fromScreen.calculatedGridPitchM).toBeCloseTo(22 / (32 * 0.86), 8)
    expect(fromScreen.estimatedSeatBlockWidthM).toBeCloseTo(22 / 0.86, 8)
    expect(fromScreen.ratioVerifiedAgainstScaledFloorPlan).toBe(false)

    const fromGrid = calculateVieShowProportionalCalibration(
      32,
      undefined,
      defaultVieShowPreviewParameters,
    )
    expect(fromGrid.method).toBe('grid-only-estimate')
    expect(fromGrid.calculatedGridPitchM).toBe(0.66)
    expect(fromGrid.estimatedSeatBlockWidthM).toBeCloseTo(32 * 0.66, 8)
    expect(() =>
      calculateVieShowProportionalCalibration(32, 22, {
        seatSpacingM: 0.66,
        screenToSeatBlockWidthRatio: 0,
      }),
    ).toThrow(/ratio/)
  })

  it('links the operator TITAN 22 × 12 m screen to the 391-seat public grid without inventing row pitch', async () => {
    const layouts = await loadVieShowArchiveForCinema('vieshow-muvie-taipei-a13')
    const titan = layouts.find((item) => item.hallNumber === 6)!
    expect(titan.ordinarySeatCount).toBe(391)
    const geometry = deriveVieShowPreviewGeometry('vieshow-muvie-taipei-a13', titan)
    expect(geometry.seats).toHaveLength(391)
    expect(geometry.auditorium.screen).toMatchObject({ width: 22, height: 12 })
    expect(geometry.screenDimensionsProvenance).toBe('operator-published')
    expect(geometry.screenSpecification).toMatchObject({
      format: 'TITAN SCREEN',
      expectedSeatCount: 391,
      identification: 'capacity-cross-reference',
    })
    expect(geometry.auditorium.rows[0]?.z).toBe(defaultVieShowPreviewParameters.frontDistanceM)
    expect(geometry.auditorium.rows[0]?.elevation).toBe(0)
  })

  it('marks Banciao IMAX measurements as secondary, and refuses guessing another hall', async () => {
    const layouts = await loadVieShowArchiveForCinema('vieshow-banqiao-megacity')
    const imax = layouts.find((item) => item.hallNumber === 6)!
    const estimated = deriveVieShowPreviewGeometry('vieshow-banqiao-megacity', imax)
    expect(estimated.screenDimensionsProvenance).toBe('independent-secondary')
    expect(estimated.auditorium.screen).toMatchObject({ width: 21.33, height: 11.46 })
    const wrong = vieShowScreenSpecification('vieshow-banqiao-megacity', {
      hallNumber: 6,
      ordinarySeatCount: 394,
    })
    expect(wrong).toBeUndefined()
    expect(vieShowScreenSpecifications).toHaveLength(2)
    const ordinary = layouts.find((item) => item.hallNumber === 5)!
    expect(
      deriveVieShowPreviewGeometry('vieshow-banqiao-megacity', ordinary).screenDimensionsProvenance,
    ).toBe('estimated')
  })

  it('preserves all observed seat labels, positions, aisles and numeric numbering across all 222 layouts', async () => {
    const locations = chainCinemas
      .filter((venue) => venue.brand === 'vieshow')
      .map((venue) => venue.slug)
    let totalLayouts = 0
    for (const location of locations) {
      const items = await loadVieShowArchiveForCinema(location)
      totalLayouts += items.length
      for (const item of items) {
        const result = deriveVieShowPreviewGeometry(location, item)
        const seatIds = new Set(item.seatPositions.map(([label]) => label))
        expect(new Set(result.seats.map((seat) => seat.id))).toEqual(seatIds)
        expect(result.seats.length).toBe(item.ordinarySeatCount)
        expect(result.wheelchairSpots).toHaveLength(item.wheelchairMarkers)
        expect(result.wheelchairSpots.every((spot) => Number.isFinite(spot.z))).toBe(true)
        expect(result.seats.every((seat) => seat.z > 0)).toBe(true)
        expect(result.seats.every((seat) => Number.isFinite(seat.eyeY))).toBe(true)
        expect(result.auditorium.screen.width).toBeGreaterThan(0)
        expect(result.auditorium.screen.height).toBeGreaterThan(0)
        expect(result.seatPositionsProvenance).toBe('operator-public-booking-preview')
        expect(result.auditorium).not.toHaveProperty('modelId')
        const chosen = initialVieShowPreviewSeat(result)
        expect(seatIds.has(chosen)).toBe(true)

        const uniqueGridRows = new Set(item.seatPositions.map((seat) => seat[1]))
        expect(result.auditorium.rows).toHaveLength(uniqueGridRows.size)
        const positionSignature = new Set(
          result.seats.map((s) => s.x.toFixed(4) + '/' + s.z.toFixed(4)),
        )
        expect(positionSignature.size).toBe(result.seats.length)
      }
    }
    expect(totalLayouts).toBe(222)
    const ximen = (await loadVieShowArchiveForCinema('vieshow-taipei-ximen')).find(
      (item) => item.hallNumber === 7,
    )!
    const numeric = deriveVieShowPreviewGeometry('vieshow-taipei-ximen', ximen)
    expect(numeric.seats.some((s) => s.id === '113')).toBe(true)
    expect(numeric.seats.some((s) => s.row === '1')).toBe(true)
    expect(numeric.seats.every((s) => !s.id.startsWith('A-'))).toBe(true)
  })

  it('lets users adjust estimated pitch/rise/distance without changing real seat IDs or sourced dimensions', async () => {
    const layout = (await loadVieShowArchiveForCinema('vieshow-muvie-taipei-a13')).find(
      (item) => item.hallNumber === 6,
    )!
    const base = deriveVieShowPreviewGeometry('vieshow-muvie-taipei-a13', layout)
    const modified = deriveVieShowPreviewGeometry('vieshow-muvie-taipei-a13', layout, {
      ...defaultVieShowPreviewParameters,
      frontDistanceM: 7.5,
      rowSpacingM: 1.5,
      rowRiseM: 0.25,
      seatSpacingM: 0.81,
      screenToSeatBlockWidthRatio: 1.1,
    })
    expect(modified.seats.map((s) => s.id)).toEqual(base.seats.map((s) => s.id))
    expect(modified.calibration.method).toBe('known-screen-width')
    expect(modified.calibration.calculatedGridPitchM).toBeLessThan(
      base.calibration.calculatedGridPitchM,
    )
    expect(modified.seats[0]?.x).not.toBeCloseTo(base.seats[0]!.x, 8)
    expect(modified.calibration.ratioVerifiedAgainstScaledFloorPlan).toBe(false)
    expect(modified.auditorium.screen).toEqual(base.auditorium.screen)
    const fallbackPitchDoesNotOverrideScreenAnchor = deriveVieShowPreviewGeometry(
      'vieshow-muvie-taipei-a13',
      layout,
      { ...defaultVieShowPreviewParameters, seatSpacingM: 0.81 },
    )
    expect(fallbackPitchDoesNotOverrideScreenAnchor.seats.map((seat) => seat.x)).toEqual(
      base.seats.map((seat) => seat.x),
    )
    expect(modified.seats[0]?.z).not.toBe(base.seats[0]?.z)
    const backRow = layout.seatPositions.reduce((best, seat) => Math.max(best, seat[1]), 0)
    const baseBack = base.seats.find((seat) => seat.row === String(backRow))!
    const modifiedBack = modified.seats.find((seat) => seat.row === String(backRow))!
    expect(modifiedBack.elevation).toBeGreaterThan(baseBack.elevation)
    expect(() =>
      deriveVieShowPreviewGeometry('vieshow-muvie-taipei-a13', layout, {
        ...defaultVieShowPreviewParameters,
        rowSpacingM: 0,
      }),
    ).toThrow(/visual estimate/)
  })
})
