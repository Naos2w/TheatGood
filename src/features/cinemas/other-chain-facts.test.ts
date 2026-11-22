import { describe, expect, it } from 'vitest'
import { chainCinemas } from './chain-directory'
import historicalPublicSeatCounts from './data/additional-chain-published-seats-2026-11-18.json'
import {
  cinemaPublishedFacts,
  MIRAMAR_HALL_SOURCE,
  miramarPublishedHalls,
  publishedNamedHallsForCinema,
  publishedNamedHallSeatSum,
} from './other-chain-facts'
import { publishedHallsForCinema, publishedSeatTotal } from './vieshow-halls'

describe('verified Showtime, Miramar and Miranew auditorium facts', () => {
  it('links all 15 Showtime and both Miranew venues plus Miramar to distinct official sources', () => {
    const known = new Set(chainCinemas.map((cinema) => cinema.slug))
    const values = Object.values(cinemaPublishedFacts)
    expect(values).toHaveLength(18)
    expect(values.filter((item) => item.cinemaSlug.startsWith('showtime-'))).toHaveLength(15)
    expect(values.filter((item) => item.cinemaSlug.startsWith('miranew-'))).toHaveLength(2)
    const showtime = values.filter((item) => item.cinemaSlug.startsWith('showtime-'))
    expect(showtime.filter((item) => item.hallCount !== undefined)).toHaveLength(12)
    expect(showtime.filter((item) => item.publishedSeatCount !== undefined)).toHaveLength(8)
    expect(values.filter((item) => item.cinemaSlug.startsWith('miramar-'))).toHaveLength(1)
    for (const item of values) {
      expect(known.has(item.cinemaSlug)).toBe(true)
      expect(item.checkedAt).toBe('2026-11-16')
      expect(item.sourceUrl).toMatch(/^https:\/\//)
      if (item.hallCount) {
        expect(item.hallCountScope).toMatch(/^(entire-cinema|digital-halls|royal-only)$/)
        expect(item.hallCount).toBeGreaterThan(0)
      }
      if (item.publishedSeatCount !== undefined) {
        expect(item.publishedSeatCount).toBeGreaterThan(0)
      }
      expect(item).not.toHaveProperty('seatLabels')
      expect(item).not.toHaveProperty('modelId')
    }
  })

  it('uses Miramar operator-labelled halls and counts, never filling missing hall 4 or 6', () => {
    expect(miramarPublishedHalls).toHaveLength(10)
    expect(publishedNamedHallSeatSum('miramar-dazhi')).toBe(2910)
    const halls = publishedNamedHallsForCinema('miramar-dazhi')
    expect(halls.map((hall) => hall.label)).toEqual([
      '1',
      '2',
      '3',
      '5',
      '7',
      '8',
      '9',
      '10',
      'Dolby Cinema',
      'IMAX',
    ])
    expect(halls.find((hall) => hall.label === 'Dolby Cinema')?.publishedSeatCount).toBe(303)
    expect(halls.find((hall) => hall.label === 'IMAX')?.publishedSeatCount).toBe(404)
    expect(halls.every((hall) => hall.sourceUrl === MIRAMAR_HALL_SOURCE)).toBe(true)
    expect(halls.every((hall) => hall.dataLevel === 'published-count-only')).toBe(true)
  })

  it('only adds operator-confirmed screen geometry, never fabricating seat distances or rows', () => {
    const halls = publishedNamedHallsForCinema('miramar-dazhi')
    const imax = halls.find((hall) => hall.label === 'IMAX')
    expect(imax).toMatchObject({
      publishedSeatCount: 404,
      screenWidthM: 28.4,
      screenHeightM: 20.54,
      screenShape: 'curved',
      screenSourceUrl: 'https://www.miramarcinemas.tw/Home/imaxcinema',
    })
    expect(halls.filter((hall) => hall.screenWidthM !== undefined)).toHaveLength(1)
    expect(halls.find((hall) => hall.label === 'Dolby Cinema')?.screenWidthM).toBeUndefined()
    expect(imax).not.toHaveProperty('rows')
    expect(imax).not.toHaveProperty('seatSpacing')
    expect(imax).not.toHaveProperty('modelId')
  })

  it('preserves Showtime total-hall counts separately from reported digital hall counts', () => {
    expect(cinemaPublishedFacts['showtime-kaohsiung-dreammall']).toMatchObject({
      hallCount: 13,
      hallCountScope: 'entire-cinema',
      publishedSeatCount: 1852,
    })
    expect(cinemaPublishedFacts['showtime-taipei-dome']).toMatchObject({
      hallCount: 14,
      hallCountScope: 'entire-cinema',
    })
    expect(cinemaPublishedFacts['showtime-keelung']).toMatchObject({
      hallCount: 8,
      hallCountScope: 'entire-cinema',
      publishedSeatCount: 1033,
    })
    expect(cinemaPublishedFacts['showtime-chiayi']).toMatchObject({
      hallCount: 10,
      hallCountScope: 'digital-halls',
      publishedSeatCount: 1387,
    })
    expect(cinemaPublishedFacts['showtime-taipei-xinxin']).toMatchObject({
      hallCount: 14,
      hallCountScope: 'digital-halls',
      publishedSeatCount: 1528,
    })
    expect(cinemaPublishedFacts['showtime-taichung-station']).toMatchObject({
      hallCount: 16,
      hallCountScope: 'digital-halls',
      publishedSeatCount: 2669,
    })
    expect(cinemaPublishedFacts['showtime-taichung-lipao']).toMatchObject({
      hallCount: 10,
      hallCountScope: 'entire-cinema',
      publishedSeatCount: 811,
      sourceUrl: 'https://www.lihpaooutlet.com.tw/Brand/Details/268',
    })
    expect(cinemaPublishedFacts['showtime-taichung-wenxin']?.publishedSeatCount).toBeUndefined()
    expect(cinemaPublishedFacts['showtime-yunlin-beigang']?.hallCount).toBeUndefined()
    expect(publishedNamedHallsForCinema('showtime-taipei-xinxin')).toEqual([])
  })

  it('never describes the two Miranew Royal halls as the entire Tai-Mall cinema', () => {
    expect(cinemaPublishedFacts['miranew-taimall']).toMatchObject({
      hallCount: 2,
      hallCountScope: 'royal-only',
    })
    expect(cinemaPublishedFacts['miranew-taimall']?.publishedSeatCount).toBeUndefined()
    expect(cinemaPublishedFacts['miranew-dazhi-royal']).toMatchObject({
      hallCount: 8,
      hallCountScope: 'royal-only',
      publishedSeatCount: 202,
    })
    expect(publishedNamedHallsForCinema('miranew-dazhi-royal')).toEqual([])
    expect(publishedNamedHallsForCinema('miranew-taimall')).toEqual([])
  })

  it('archives 222 public hall capacities across four chains without fabricating any seat grids', () => {
    expect(historicalPublicSeatCounts.observedDate).toBe('2026-11-18')
    expect(historicalPublicSeatCounts.checkedRealtimeNow).toBe(false)
    expect(historicalPublicSeatCounts.physicalSeatGridVerified).toBe(false)
    expect(historicalPublicSeatCounts.records).toHaveLength(222)
    const counts = { ambassador: 81, in89: 54, broadway: 25, centuryasia: 62 }
    for (const [brand, total] of Object.entries(counts)) {
      const published = historicalPublicSeatCounts.records.filter((row) => row.brand === brand)
      expect(published).toHaveLength(total)
      expect(
        published.every(
          (row) =>
            row.seatGridVerified === false &&
            !('seatPositions' in row) &&
            !('seatLabels' in row) &&
            row.publishedSeatCount > 0 &&
            row.sourceUrl.startsWith('https://'),
        ),
      ).toBe(true)
    }
    for (const slug of new Set(historicalPublicSeatCounts.records.map((row) => row.cinemaSlug))) {
      const rows = historicalPublicSeatCounts.records.filter((row) => row.cinemaSlug === slug)
      const displayed = publishedNamedHallsForCinema(slug)
      expect(displayed).toHaveLength(rows.length)
      expect(displayed.every((row) => row.dataLevel === 'published-count-only')).toBe(true)
      expect(displayed.map((row) => row.label)).toEqual(rows.map((row) => row.hallLabel))
    }
    expect(publishedNamedHallsForCinema('skcinemas-taoyuan-qingpu')).toEqual([])
    expect(publishedNamedHallsForCinema('in89-chiayi')).toHaveLength(9)
    expect(publishedNamedHallsForCinema('ambassador-taipei-ximenting')).toHaveLength(3)
  })

  it('does not regress all 229 existing Vie Show source-derived hall counts', () => {
    const halls = publishedHallsForCinema('vieshow-taipei-hsinyi')
    const unified = publishedNamedHallsForCinema('vieshow-taipei-hsinyi')
    expect(unified).toHaveLength(halls.length)
    expect(unified[0]).toMatchObject({
      cinemaSlug: 'vieshow-taipei-hsinyi',
      label: '1',
      publishedSeatCount: 174,
    })
    expect(publishedNamedHallSeatSum('vieshow-taipei-hsinyi')).toBe(
      publishedSeatTotal('vieshow-taipei-hsinyi'),
    )
    expect(publishedNamedHallSeatSum('showtime-taipei-dome')).toBe(0)
  })
})
