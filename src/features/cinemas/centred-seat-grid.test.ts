import { describe, expect, it } from 'vitest'
import { chainCinemas } from './chain-directory'
import { loadVieShowArchiveForCinema } from './vieshow-seat-archive'
import { centreSeatGrid } from './centred-seat-grid'

describe('centred source-attributed 2D seating grids', () => {
  it('centres occupied seats and wheelchair markers rather than unused booking table columns', () => {
    const layout = {
      seatPositions: [
        ['A01', 1, 3],
        ['A02', 1, 4],
        ['A03', 2, 16],
      ] as [string, number, number][],
      wheelchairPositions: [[3, 17]] as [number, number][],
      gridRows: 7,
      gridColumns: 52,
    }
    const map = centreSeatGrid(layout)
    const left = map.seatX(3)
    const right = map.seatX(17) + 26
    expect((left + right) / 2).toBeCloseTo(map.width / 2, 6)
    expect((map.screenStartX + map.screenEndX) / 2).toBe(map.width / 2)
    expect(map.labelX(4) - map.seatX(4)).toBe(13)
    expect(map.seatX(17)).toBeGreaterThan(map.seatX(16))
    expect(map.width).toBeLessThan(52 * 30)
  })

  it('all 222 sourced layouts keep their real column gaps and share a centred screen', async () => {
    let count = 0
    for (const venue of chainCinemas.filter((item) => item.brand === 'vieshow')) {
      const layouts = await loadVieShowArchiveForCinema(venue.slug)
      for (const layout of layouts) {
        for (const [cellWidth, cellHeight, minWidth] of [
          [30, 31, 560],
          [31, 31, 540],
        ]) {
          const map = centreSeatGrid(layout, cellWidth, cellHeight, minWidth)
          const columns = [
            ...layout.seatPositions.map((seat) => seat[2]),
            ...layout.wheelchairPositions.map((position) => position[1]),
          ]
          const left = map.seatX(Math.min(...columns))
          const right = map.seatX(Math.max(...columns)) + 26
          expect((left + right) / 2).toBeCloseTo(map.width / 2, 6)
          expect((map.screenStartX + map.screenEndX) / 2).toBeCloseTo(map.width / 2, 6)
          expect(left).toBeGreaterThanOrEqual(0)
          expect(right).toBeLessThanOrEqual(map.width)
          expect(map.seatX(4) - map.seatX(3)).toBe(cellWidth)
          expect(map.height).toBeGreaterThan(0)
        }
        count++
      }
    }
    expect(count).toBe(222)
  })

  it('rejects a chart with no actual locations or impossible dimensions', () => {
    expect(() =>
      centreSeatGrid({ seatPositions: [], wheelchairPositions: [], gridRows: 1 }),
    ).toThrow(/no positions/)
    expect(() =>
      centreSeatGrid({ seatPositions: [['A01', 1, 1]], wheelchairPositions: [], gridRows: 1 }, 0),
    ).toThrow(/positive/)
  })
})
