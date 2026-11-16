import { describe, expect, it } from 'vitest'
import { chainCinemas } from './chain-directory'
import {
  publishedHallsForCinema,
  publishedSeatTotal,
  publishedVieshowHalls,
  VIESHOW_HALL_SOURCE,
  VIESHOW_HALL_SOURCE_DATE,
} from './vieshow-halls'

describe('2026 Vie Show published numbered-hall seat counts', () => {
  it('indexes the 22 official columns with 229 factual per-hall counts', () => {
    expect(publishedVieshowHalls).toHaveLength(229)
    const venueSlugs = new Set(chainCinemas.map((venue) => venue.slug))
    expect(new Set(publishedVieshowHalls.map((hall) => hall.cinemaSlug)).size).toBe(22)
    expect(
      publishedVieshowHalls.every(
        (hall) =>
          venueSlugs.has(hall.cinemaSlug) &&
          hall.sourceUrl === VIESHOW_HALL_SOURCE &&
          hall.sourceDate === VIESHOW_HALL_SOURCE_DATE &&
          hall.dataLevel === 'published-count-only' &&
          hall.publishedSeatCount > 0,
      ),
    ).toBe(true)
    expect(
      new Set(publishedVieshowHalls.map((hall) => hall.cinemaSlug + '/' + hall.hallNumber)).size,
    ).toBe(publishedVieshowHalls.length)
  })

  it('matches operator-reported Hsin-Yi and renamed Taichung iFG totals', () => {
    const hsinyi = publishedHallsForCinema('vieshow-taipei-hsinyi')
    expect(hsinyi).toHaveLength(15)
    expect(hsinyi.find((hall) => hall.hallNumber === 1)?.publishedSeatCount).toBe(174)
    expect(hsinyi.find((hall) => hall.hallNumber === 16)?.publishedSeatCount).toBe(112)
    expect(publishedSeatTotal('vieshow-taipei-hsinyi')).toBe(2681)
    const taichung = publishedHallsForCinema('vieshow-taichung-ifg')
    expect(taichung).toHaveLength(9)
    expect(publishedSeatTotal('vieshow-taichung-ifg')).toBe(1781)
  })

  it('never guesses hall 4, special-format text or exact seat geometry', () => {
    expect(publishedVieshowHalls.some((hall) => hall.hallNumber === 4)).toBe(false)
    expect(publishedVieshowHalls.some((hall) => hall.hallNumber >= 20)).toBe(false)
    expect(publishedHallsForCinema('showtime-taipei-dome')).toEqual([])
    expect(publishedSeatTotal('miramar-dazhi')).toBe(0)
    expect(
      publishedVieshowHalls.every(
        (hall) =>
          !('seatPositions' in hall) &&
          !('modelId' in hall) &&
          !('format' in hall) &&
          !('screenWidthM' in hall),
      ),
    ).toBe(true)
  })
})
