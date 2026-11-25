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
      verifiedHalls: 31,
      sourcedVenues: 2,
      normalSeats: 1266,
      wheelchairPositions: 31,
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
      [38, 39],
      [50, 51],
      [31, 32],
      [31, 32],
      [28, 29],
      [31, 32],
      [31, 32],
      [31, 32],
      [30, 31],
      [31, 32],
      [31, 32],
      [43, 44],
      [48, 49],
      [103, 104],
      [31, 32],
      [35, 36],
      [43, 44],
      [48, 49],
      [39, 40],
      [43, 44],
      [48, 49],
      [43, 44],
      [31, 32],
      [35, 36],
      [39, 40],
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
    expect(centuryasiaPublicSeatLayouts[6].id).toBe('centuryasia-yonghe-13')
    expect(centuryasiaPublicSeatLayouts[6].wheelchairPositions).toEqual([[1, 3]])
    expect(centuryasiaPublicSeatLayouts[6].gridColumns).toBe(11)
    expect(centuryasiaPublicSeatLayouts[7].id).toBe('centuryasia-yonghe-2')
    expect(centuryasiaPublicSeatLayouts[7].wheelchairPositions).toEqual([[1, 3]])
    expect(centuryasiaPublicSeatLayouts[7].gridColumns).toBe(16)
    for (const [index, number] of [
      [8, 7],
      [9, 8],
    ]) {
      expect(centuryasiaPublicSeatLayouts[index].id).toBe('centuryasia-yonghe-' + number)
      expect(centuryasiaPublicSeatLayouts[index].wheelchairPositions).toEqual([[1, 7]])
      expect(centuryasiaPublicSeatLayouts[index].gridColumns).toBe(9)
    }
    for (const [index, number, col] of [
      [10, 1, 2],
      [11, 4, 7],
      [12, 6, 7],
      [13, 9, 3],
      [14, 5, 3],
      [15, 10, 3],
      [16, 11, 7],
    ]) {
      expect(centuryasiaPublicSeatLayouts[index].id).toBe('centuryasia-yonghe-' + number)
      expect(centuryasiaPublicSeatLayouts[index].wheelchairPositions).toEqual([[1, col]])
      expect(centuryasiaPublicSeatLayouts[index].gridColumns).toBe(9)
    }
    const nangang7 = centuryasiaPublicSeatLayouts.find(
      (hall) => hall.id === 'centuryasia-nangang-7',
    )!
    expect(nangang7.wheelchairPositions).toEqual([[1, 11]])
    expect(nangang7.gridColumns).toBe(12)
    expect(nangang7.seatPositions.filter((p) => p[1] === 1)).toHaveLength(9)
    const nangang6 = centuryasiaPublicSeatLayouts.find(
      (hall) => hall.id === 'centuryasia-nangang-6',
    )!
    expect(nangang6.wheelchairPositions).toEqual([[1, 14]])
    expect(nangang6.gridColumns).toBe(14)
    expect(nangang6.seatPositions.filter((p) => p[1] === 1)).toHaveLength(10)
    expect(nangang6.seatPositions.some((p) => p[1] === 2 && [7, 8].includes(p[2]))).toBe(false)
    const nangang1 = centuryasiaPublicSeatLayouts.find(
      (hall) => hall.id === 'centuryasia-nangang-1',
    )!
    expect(nangang1.wheelchairPositions).toEqual([[1, 12]])
    expect(nangang1.gridRows).toBe(9)
    expect(nangang1.gridColumns).toBe(12)
    expect(nangang1.seatPositions.filter((p) => p[1] === 9)).toHaveLength(9)
    expect(nangang1.seatPositions).toContainEqual(['9-01', 9, 4])
    const nangang4 = centuryasiaPublicSeatLayouts.find(
      (hall) => hall.id === 'centuryasia-nangang-4',
    )!
    expect(nangang4.wheelchairPositions).toEqual([[1, 9]])
    expect(nangang4.gridRows).toBe(4)
    expect(nangang4.gridColumns).toBe(10)
    expect(nangang4.seatPositions.filter((p) => p[1] === 1)).toHaveLength(6)
    expect(nangang4.seatPositions).toContainEqual(['4-09', 4, 10])
    expect(nangang4.seatPositions.some((p) => p[2] === 1)).toBe(false)
    for (const [number, columns, wheel, counts] of [
      [3, 11, 10, [7, 9, 9, 10]],
      [8, 13, 12, [9, 11, 11, 12]],
      [10, 14, 14, [10, 12, 12, 14]],
      [22, 13, 11, [8, 10, 10, 11]],
      [2, 13, 12, [9, 11, 11, 12]],
      [9, 14, 14, [10, 12, 12, 14]],
      [11, 13, 12, [9, 11, 11, 12]],
      [12, 10, 9, [6, 8, 8, 9]],
      [13, 11, 10, [7, 9, 9, 10]],
      [16, 12, 11, [8, 10, 10, 11]],
    ] as const) {
      const hall = centuryasiaPublicSeatLayouts.find(
        (item) => item.id === 'centuryasia-nangang-' + number,
      )!
      expect(hall.gridRows).toBe(4)
      expect(hall.gridColumns).toBe(columns)
      expect(hall.wheelchairPositions).toEqual([[1, wheel]])
      expect(
        [1, 2, 3, 4].map((row) => hall.seatPositions.filter((p) => p[1] === row).length),
      ).toEqual(counts)
    }
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
