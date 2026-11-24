import { describe, expect, it } from 'vitest'
import raw from './data/centuryasia-public-grids-2026-11-24.json'
import {
  centuryasiaPublicSeatLayouts,
  centuryasiaPublicSeatSummary,
  validateCenturyAsiaPublicLayout,
} from './centuryasia-seat-layouts'
import { deriveVieShowPreviewGeometry } from '../viewer/vieshow-approximate-scene'

describe('Century Asia public numbered halls', () => {
  it('reconciles all official capacities, excluding wheelchair positions from ordinary seats', () => {
    expect(centuryasiaPublicSeatSummary).toMatchObject({
      verifiedHalls: 6,
      sourcedVenues: 2,
      normalSeats: 274,
      wheelchairPositions: 6,
    })
    expect(
      centuryasiaPublicSeatLayouts.map((h) => [h.ordinarySeatCount, h.publishedSeatCount]),
    ).toEqual([
      [48, 49],
      [37, 38],
      [48, 49],
      [43, 44],
      [48, 49],
      [50, 51],
    ])
    expect(centuryasiaPublicSeatLayouts[0].wheelchairPositions).toEqual([[1, 14]])
    expect(centuryasiaPublicSeatLayouts[1].wheelchairPositions).toEqual([[1, 9]])
    expect(
      centuryasiaPublicSeatLayouts[0].seatPositions.some(
        (p) => p[1] === 1 && [7, 8].includes(p[2]),
      ),
    ).toBe(false)
    expect(centuryasiaPublicSeatLayouts[2].id).toBe('centuryasia-nangang-18')
    expect(centuryasiaPublicSeatLayouts[2].wheelchairPositions).toEqual([[1, 14]])
    expect(
      centuryasiaPublicSeatLayouts[2].seatPositions.some(
        (p) => p[1] === 2 && [7, 8].includes(p[2]),
      ),
    ).toBe(false)
    expect(centuryasiaPublicSeatLayouts[3].id).toBe('centuryasia-nangang-23')
    expect(centuryasiaPublicSeatLayouts[3].wheelchairPositions).toEqual([[1, 12]])
    expect(centuryasiaPublicSeatLayouts[3].gridColumns).toBe(13)
    expect(
      centuryasiaPublicSeatLayouts[3].seatPositions.some((p) => p[1] === 1 && p[2] === 1),
    ).toBe(false)
    expect(centuryasiaPublicSeatLayouts[4].id).toBe('centuryasia-nangang-24')
    expect(centuryasiaPublicSeatLayouts[4].wheelchairPositions).toEqual([[1, 14]])
    expect(centuryasiaPublicSeatLayouts[4].gridColumns).toBe(14)
    expect(centuryasiaPublicSeatLayouts[5].id).toBe('centuryasia-yonghe-3')
    expect(centuryasiaPublicSeatLayouts[5].wheelchairPositions).toEqual([[1, 12]])
    expect(centuryasiaPublicSeatLayouts[5].gridColumns).toBe(13)
    for (const hall of centuryasiaPublicSeatLayouts) {
      const result = deriveVieShowPreviewGeometry(hall.cinemaSlug, hall)
      expect(result.auditorium.id).toContain('centuryasia-preview-')
      expect(result.screenDimensionsProvenance).toBe('estimated')
    }
  })
  it('rejects changed hall identity, off-host source and overlap', () => {
    const item = raw.layouts[0]
    expect(() => validateCenturyAsiaPublicLayout({ ...item, hallNumber: 6 })).toThrow()
    expect(() =>
      validateCenturyAsiaPublicLayout({
        ...item,
        sourceRequest: item.sourceRequest.replace('www.centuryasia.com.tw', 'example.org'),
      }),
    ).toThrow()
    expect(() =>
      validateCenturyAsiaPublicLayout({
        ...item,
        seatPositions: [...item.seatPositions.slice(0, -1), item.seatPositions[0]],
      }),
    ).toThrow()
  })
})
