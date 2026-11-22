import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ESTIMATED_SEAT_POV_HORIZONTAL_FOV,
  DEFAULT_SCREEN_TO_SEAT_BLOCK_RATIO,
} from '../cinemas/seat-screen-assumptions'
import { centreSeatGrid } from '../cinemas/centred-seat-grid'
import { loadVieShowArchiveForCinema } from '../cinemas/vieshow-seat-archive'
import {
  defaultVieShowPreviewParameters,
  deriveVieShowPreviewGeometry,
} from './vieshow-approximate-scene'
import { verticalFovFromHorizontal } from './view-projection'

describe('2D screen reference and estimated 3D viewport consistency', () => {
  it('shares the same illustrative screen / seating-block width ratio', async () => {
    const halls = await loadVieShowArchiveForCinema('vieshow-hsinchu-bigcity')
    const hall = halls.find((item) => item.hallNumber === 2)!
    const view = deriveVieShowPreviewGeometry('vieshow-hsinchu-bigcity', hall)
    const diagram = centreSeatGrid(hall)
    const svgScreenLine = diagram.screenEndX - diagram.screenStartX

    expect(view.screenDimensionsProvenance).toBe('estimated')
    expect(defaultVieShowPreviewParameters.screenToSeatBlockWidthRatio).toBe(
      DEFAULT_SCREEN_TO_SEAT_BLOCK_RATIO,
    )
    expect(svgScreenLine / diagram.occupiedWidth).toBeCloseTo(DEFAULT_SCREEN_TO_SEAT_BLOCK_RATIO, 6)
    expect(view.auditorium.screen.width / view.calibration.estimatedSeatBlockWidthM).toBeCloseTo(
      DEFAULT_SCREEN_TO_SEAT_BLOCK_RATIO,
      6,
    )
    expect(hall.seatPositions.some(([label]) => label === 'G12')).toBe(true)
    expect(hall.seatPositions.some(([label]) => label === 'K24')).toBe(true)
    expect(view.seats.find((s) => s.id === 'G12')?.z).toBeLessThan(
      view.seats.find((s) => s.id === 'K24')!.z,
    )
  })

  it('restores the immersive seat-view lens without changing physical screen dimensions', async () => {
    const hall = (await loadVieShowArchiveForCinema('vieshow-hsinchu-bigcity')).find(
      (item) => item.hallNumber === 2,
    )!
    const model = deriveVieShowPreviewGeometry('vieshow-hsinchu-bigcity', hall)
    const projectedWidthAtDistance = (horizontalFov: number, z: number) =>
      model.auditorium.screen.width / (2 * z * Math.tan((horizontalFov * Math.PI) / 360))
    const seat = model.seats.find((s) => s.id === 'K24')!
    expect(DEFAULT_ESTIMATED_SEAT_POV_HORIZONTAL_FOV).toBe(65)
    expect(
      projectedWidthAtDistance(DEFAULT_ESTIMATED_SEAT_POV_HORIZONTAL_FOV, seat.z),
    ).toBeGreaterThan(projectedWidthAtDistance(80, seat.z))
    expect(
      verticalFovFromHorizontal(DEFAULT_ESTIMATED_SEAT_POV_HORIZONTAL_FOV, 16 / 9),
    ).toBeLessThan(verticalFovFromHorizontal(80, 16 / 9))
    expect(model.auditorium.screen.width).toBeGreaterThan(0)
  })
})
