import { describe, expect, it } from 'vitest'
import raw from './data/broadway-public-grids-2026-11-24.json'
import {
  broadwayPublicSeatLayouts,
  broadwayPublicSeatSummary,
  broadwayHasVerifiedHall,
  broadwaySeatLayoutsForCinema,
  validateBroadwayPublicLayout,
} from './broadway-seat-layouts'
import { deriveVieShowPreviewGeometry } from '../viewer/vieshow-approximate-scene'
import { pendingChain3DVenues, source3DVenues } from '../viewer/source-3d-catalogue'

describe('Broadway official public QUICK VIEW seat-grid verification', () => {
  it('keeps distinct authenticated numbered public previews in both cinemas', () => {
    expect(broadwayPublicSeatSummary).toMatchObject({
      observedAt: '2026-11-24',
      verifiedHalls: 3,
      sourcedVenues: 2,
      normalSeats: 146,
      wheelchairPositions: 3,
    })
    expect(broadwaySeatLayoutsForCinema('broadway-zhubei')).toHaveLength(2)
    expect(broadwaySeatLayoutsForCinema('broadway-gongguan')).toHaveLength(1)
    expect(broadwayHasVerifiedHall('broadway-zhubei', '7')).toBe(true)
    expect(broadwayHasVerifiedHall('broadway-zhubei', '10')).toBe(true)
    const additional = broadwaySeatLayoutsForCinema('broadway-zhubei').find(
      (h) => h.hallNumber === 10,
    )
    expect(additional).toMatchObject({
      ordinarySeatCount: 75,
      wheelchairMarkers: 2,
      publishedSeatCount: 77,
      gridRows: 7,
      gridColumns: 15,
    })
    expect(broadwayHasVerifiedHall('broadway-gongguan', '10')).toBe(true)
    expect(broadwayHasVerifiedHall('broadway-gongguan', '7')).toBe(false)
    expect(broadwayHasVerifiedHall('broadway-zhubei', '8')).toBe(false)
  })

  it('verifies 42 original Zhubei Hall 7 seats, 29+1 Gongguan Hall 10 positions', () => {
    const zhubei = broadwaySeatLayoutsForCinema('broadway-zhubei')[0]!
    const taipei = broadwaySeatLayoutsForCinema('broadway-gongguan')[0]!
    expect(zhubei).toMatchObject({
      hallNumber: 7,
      hallLabel: '第7廳',
      ordinarySeatCount: 42,
      wheelchairMarkers: 0,
      gridRows: 5,
      gridColumns: 13,
      publishedSeatCount: 42,
      countComparison: 'exact',
    })
    expect(taipei).toMatchObject({
      hallNumber: 10,
      hallLabel: '第10廳',
      ordinarySeatCount: 29,
      wheelchairMarkers: 1,
      gridRows: 4,
      gridColumns: 13,
      publishedSeatCount: 30,
      countComparison: 'wheelchair-markers-match',
    })
    expect(zhubei.seatPositions).toContainEqual(['1-08', 1, 2])
    expect(zhubei.seatPositions).toContainEqual(['5-01', 5, 12])
    expect(taipei.wheelchairPositions).toContainEqual([1, 9])
    for (const hall of broadwayPublicSeatLayouts) {
      expect(hall.snapshotSource).toMatch(
        /^https:\/\/www\.broadway-cineplex\.com\.tw\/quick-view\.html\?obj=/,
      )
      expect(hall.seatPositions.every(([id]) => /^\d+-\d+$/.test(id))).toBe(true)
      expect(new Set(hall.seatPositions.map(([id]) => id)).size).toBe(hall.ordinarySeatCount)
      expect(new Set(hall.seatPositions.map(([, row, col]) => row + '/' + col)).size).toBe(
        hall.ordinarySeatCount,
      )
      expect(hall).not.toHaveProperty('choice')
      expect(hall).not.toHaveProperty('available')
      expect(hall).not.toHaveProperty('sessionId')
      expect(hall).not.toHaveProperty('ticket')
    }
  })

  it('derives original 2D row/aisle seats and estimated 3D geometry without invented chairs', () => {
    for (const hall of broadwayPublicSeatLayouts) {
      const preview = deriveVieShowPreviewGeometry(hall.cinemaSlug, hall)
      expect(preview.seats).toHaveLength(hall.ordinarySeatCount)
      expect(preview.wheelchairSpots).toHaveLength(hall.wheelchairMarkers)
      expect(new Set(preview.seats.map((seat) => seat.id))).toEqual(
        new Set(hall.seatPositions.map(([id]) => id)),
      )
      expect(preview.screenDimensionsProvenance).toBe('estimated')
      expect(preview.calibration.method).toBe('grid-only-estimate')
      expect(preview.auditorium.id).toBe('broadway-preview-' + hall.id)
      expect(preview.calibration.ratioVerifiedAgainstScaledFloorPlan).toBe(false)
    }
  })

  it('refuses wrong source identity, duplicated seats, made-up occupancy and bad count', () => {
    const original = raw.layouts[0]!
    const forged = structuredClone(original)
    forged.snapshotSource =
      'https://example.org/quick-view.html?obj=Zhubei,0000982,2026-11-24,20-30,0007'
    expect(() => validateBroadwayPublicLayout(forged)).toThrow(/provenance/)
    const wrongHall = structuredClone(original)
    wrongHall.hallNumber = 8
    expect(() => validateBroadwayPublicLayout(wrongHall)).toThrow(/identity/)
    const duplicate = structuredClone(original)
    duplicate.seatPositions[0] = [...duplicate.seatPositions[1]!]
    expect(() => validateBroadwayPublicLayout(duplicate)).toThrow(/Overlap|overlap|fabricated/)
    const privateState = {
      ...structuredClone(original),
      choice: 'AVAILABLE',
    } as typeof original
    expect(() => validateBroadwayPublicLayout(privateState)).toThrow(/provenance/)
    const wrongCount = structuredClone(original)
    wrongCount.ordinarySeatCount += 1
    expect(() => validateBroadwayPublicLayout(wrongCount)).toThrow(/reconcile/)
  })

  it('shows two Broadway supported venues while leaving their other 22 halls pending', () => {
    const sourced = source3DVenues()
    expect(sourced.filter((x) => x.brand === 'broadway').length).toBe(2)
    expect(sourced.length).toBe(44)
    expect(pendingChain3DVenues()).toHaveLength(22)
    expect(pendingChain3DVenues().some((c) => c.brand === 'broadway')).toBe(false)
  })
})
