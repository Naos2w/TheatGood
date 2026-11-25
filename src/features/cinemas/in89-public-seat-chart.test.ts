import { describe, expect, it } from 'vitest'
import raw from './data/in89-chiayi-coach2-public-chart-2026-02.json'
import {
  in89HasPublishedFullGrid,
  in89InstitutionSeatCharts,
  in89PublicSeatSourceSummary,
  in89SeatChartsForCinema,
  validateIn89InstitutionalGrid,
} from './in89-public-seat-chart'
import { deriveVieShowPreviewGeometry } from '../viewer/vieshow-approximate-scene'
import {
  in89PublicChartEntries,
  pendingChain3DVenues,
  source3DVenues,
} from '../viewer/source-3d-catalogue'

describe('2026-01 and 2026-02 public school charts for in89 Chiayi COACH 2', () => {
  it('keeps precise historical provenance and current capacity cross-check distinct', () => {
    expect(in89PublicSeatSourceSummary).toMatchObject({
      venueCount: 1,
      layoutCount: 1,
      ordinarySeats: 93,
      wheelchairPositions: 2,
      currentPhysicalGridReconfirmed: false,
    })
    const item = in89SeatChartsForCinema('in89-chiayi')[0]!
    expect(item.hallLabel).toBe('COACH 第2廳')
    expect(item.sourcePublicationDates).toEqual(['2026-01-28', '2026-02-04'])
    expect(item.sourceImages).toHaveLength(2)
    expect(item.verifiedCurrentPhysicalLayout).toBe(false)
    expect(item.provenance).toBe('public-school-2026-seat-diagram')
    expect(item.publishedSeatCount).toBe(95)
    expect(item.countComparison).toBe('wheelchair-markers-match')
    expect(in89HasPublishedFullGrid('in89-chiayi', 'C2')).toBe(true)
    expect(in89HasPublishedFullGrid('in89-chiayi', 'C1')).toBe(false)
  })
  it('follows both published diagram row blocks, aisle and accessible cells without fake seats', () => {
    const x = in89InstitutionSeatCharts[0]!
    expect(x.seatPositions).toHaveLength(93)
    expect(x.wheelchairPositions).toEqual([
      [1, 2],
      [1, 3],
    ])
    expect(x.gridRows).toBe(7)
    expect(x.gridColumns).toBe(15)
    expect(x.seatPositions).toContainEqual(['A10', 1, 6])
    expect(x.seatPositions).toContainEqual(['A1', 1, 15])
    expect(x.seatPositions).toContainEqual(['B14', 2, 1])
    expect(x.seatPositions).toContainEqual(['B1', 2, 15])
    expect(x.seatPositions).toContainEqual(['G13', 7, 1])
    expect(x.seatPositions).toContainEqual(['G10', 7, 4])
    expect(x.seatPositions).toContainEqual(['G9', 7, 6])
    expect(x.seatPositions).toContainEqual(['G1', 7, 14])
    expect(x.seatPositions.every(([, , col]) => col !== 5)).toBe(true)
    expect(new Set(x.seatPositions.map(([id]) => id)).size).toBe(93)
    expect(new Set(x.seatPositions.map(([, row, col]) => row + '/' + col)).size).toBe(93)
    for (const row of 'ABCDEFG') {
      expect(x.seatPositions.filter(([id]) => id.startsWith(row))).toHaveLength(
        row === 'A' ? 10 : row === 'G' ? 13 : 14,
      )
    }
  })
  it('produces one sourced 2D seating model and honest estimated 3D scene', () => {
    const item = in89InstitutionSeatCharts[0]!
    const scene = deriveVieShowPreviewGeometry(item.cinemaSlug, item)
    expect(scene.seats).toHaveLength(93)
    expect(scene.wheelchairSpots).toHaveLength(2)
    expect(scene.auditorium.id).toBe('in89-public-2026-preview-in89-chiayi-coach2')
    expect(scene.seatPositionsProvenance).toBe('dated-public-institution-chart')
    expect(scene.screenDimensionsProvenance).toBe('estimated')
    expect(scene.calibration.method).toBe('grid-only-estimate')
    expect(in89PublicChartEntries('in89-chiayi')).toMatchObject([
      { path: '/cinemas/in89-chiayi/halls/in89-chiayi-coach2', count: 93 },
    ])
    expect(source3DVenues().filter((c) => c.brand === 'in89')).toHaveLength(1)
    expect(source3DVenues()).toHaveLength(44)
    expect(pendingChain3DVenues()).toHaveLength(22)
  })
  it('rejects fabricated labels/coordinates, leaked booking data, source substitution or counts', () => {
    const base = raw.layouts[0]!
    const wrongDomain = structuredClone(base)
    wrongDomain.snapshotSources[0] = 'https://example.com/seat-plan.php'
    expect(() => validateIn89InstitutionalGrid(wrongDomain)).toThrow(/provenance/)
    const fake = structuredClone(base)
    fake.seatPositions[0] = ['A10', 1, 2]
    expect(() => validateIn89InstitutionalGrid(fake)).toThrow(/collid|Invalid/)
    const missing = structuredClone(base)
    missing.ordinarySeatCount = 92
    expect(() => validateIn89InstitutionalGrid(missing)).toThrow(/metadata/)
    const status = { ...structuredClone(base), availability: 'available' } as typeof base
    expect(() => validateIn89InstitutionalGrid(status)).toThrow(/metadata/)
    const fakeFuture = structuredClone(base)
    fakeFuture.estimatedCurrentLayoutUnchanged = true
    expect(() => validateIn89InstitutionalGrid(fakeFuture)).toThrow(/metadata/)
  })
})
