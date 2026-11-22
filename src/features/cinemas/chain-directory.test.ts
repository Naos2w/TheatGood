import { describe, expect, it } from 'vitest'
import { chainCinemas, searchChainCinemas } from './chain-directory'

describe('prioritised major Taiwan cinema chains', () => {
  it('includes 40 existing venues plus 26 historical operator-listed chain branches without inventing seat grids', () => {
    expect(chainCinemas).toHaveLength(66)
    const count = (brand: string) => chainCinemas.filter((cinema) => cinema.brand === brand).length
    expect([count('vieshow'), count('showtime'), count('miramar'), count('miranew')]).toEqual([
      22, 15, 1, 2,
    ])
    expect([
      count('ambassador'),
      count('in89'),
      count('broadway'),
      count('centuryasia'),
      count('skcinemas'),
    ]).toEqual([9, 6, 2, 4, 5])
    expect(new Set(chainCinemas.map((cinema) => cinema.slug)).size).toBe(66)
    expect(
      chainCinemas.every(
        (cinema) =>
          ['2026-11-16', '2026-11-18'].includes(cinema.checkedAt) &&
          cinema.city.length >= 3 &&
          cinema.address.startsWith(cinema.city) &&
          cinema.sourceUrl.startsWith('https://'),
      ),
    ).toBe(true)
    expect(
      chainCinemas.every(
        (cinema) =>
          !('seatCount' in cinema) &&
          !('screenWidth' in cinema) &&
          !('showtimes' in cinema) &&
          !('latitude' in cinema),
      ),
    ).toBe(true)
  })

  it('labels newer branch listings as historical, with no verified current operation', () => {
    const researched = chainCinemas.filter((cinema) => cinema.checkedAt === '2026-11-18')
    expect(researched).toHaveLength(26)
    expect(
      researched.every((cinema) => cinema.operatingNowVerified === false && cinema.listingEvidence),
    ).toBe(true)
    expect(
      researched.every((cinema) => !('seatPositions' in cinema) && !('hallSeatCount' in cinema)),
    ).toBe(true)
    expect(searchChainCinemas('八德置地', 'ambassador')).toHaveLength(1)
    expect(searchChainCinemas('高雄大立', 'in89')).toHaveLength(1)
  })

  it('excludes closed Miranew Hon-Hui but preserves the Tai-Mall and Da-Zhi branches', () => {
    expect(searchChainCinemas('美麗新')).toHaveLength(2)
    expect(searchChainCinemas('宏匯')).toHaveLength(0)
    expect(searchChainCinemas('台茂')).toHaveLength(1)
  })

  it('supports brand/city/search filters with normalised full-width text', () => {
    expect(searchChainCinemas('威秀', 'vieshow')).toHaveLength(20)
    expect(searchChainCinemas('MUVIE', 'vieshow')).toHaveLength(2)
    expect(searchChainCinemas('大巨蛋', 'showtime')).toHaveLength(1)
    expect(searchChainCinemas('IMAX', 'miramar')).toHaveLength(0)
    expect(searchChainCinemas('', 'all', '高雄市').length).toBeGreaterThan(3)
    expect(searchChainCinemas('ＴＩＧＥＲ　ＣＩＴＹ')).toHaveLength(1)
    expect(searchChainCinemas('不存在', 'all')).toHaveLength(0)
  })
})
