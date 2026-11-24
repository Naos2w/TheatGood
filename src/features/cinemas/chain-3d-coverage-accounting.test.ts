import { describe, expect, it } from 'vitest'
import vieShowCoverage from './data/vieshow-coverage-2026-11-16.json'
import miranewPatterns from './data/miranew-observed-seats-2026-11-16.json'
import { chainCinemas } from './chain-directory'
import { pendingChainSeatSourceWorklist } from './chain-seat-evidence'
import { cinemaPublishedFacts } from './other-chain-facts'

describe('cross-chain evidence coverage counts (no private grids loaded)', () => {
  it('keeps the real branch categories distinct from preview entries', () => {
    expect(chainCinemas).toHaveLength(66)
    expect(chainCinemas.filter((x) => x.brand === 'vieshow')).toHaveLength(22)
    expect(chainCinemas.filter((x) => x.brand === 'showtime')).toHaveLength(15)
    expect(chainCinemas.filter((x) => x.brand === 'miranew')).toHaveLength(2)
    expect(vieShowCoverage.totals.venues).toBe(22)
    expect(vieShowCoverage.totals.layouts).toBe(222)
    expect(miranewPatterns.layouts).toHaveLength(13)
    // 159 Showtime source grids live in owner-authorised MSI storage only;
    // this test never counts them from a public asset or invented fixture.
  })

  it('records all 24 unobserved VieShow official numbered halls including which branches need sources', () => {
    expect(vieShowCoverage.totals.officialEntries).toBe(229)
    expect(vieShowCoverage.totals.matchedOfficialEntries).toBe(205)
    expect(vieShowCoverage.totals.missingOfficialEntries).toBe(24)
    const missing = vieShowCoverage.venues.filter((x) => x.missingOfficialHalls.length > 0)
    expect(missing).toHaveLength(8)
    expect(missing.reduce((n, x) => n + x.missingOfficialHalls.length, 0)).toBe(24)
    const tainan = missing.find((v) => v.venueSlug === 'vieshow-tainan-tsmall')
    expect(tainan?.missingOfficialHalls).toEqual([11, 12, 13, 14, 15, 17, 19])
  })

  it('keeps 223 remaining capacity-only records separate from nine sourced public grids', () => {
    const work = pendingChainSeatSourceWorklist()
    expect(work).toHaveLength(228)
    expect(new Set(work.map((x) => x.cinemaSlug)).size).toBe(27)
    expect(work.filter((x) => x.publishedSeatCount !== null)).toHaveLength(223)
    const noHallCensus = work.filter((x) => x.hallLabel === null)
    expect(noHallCensus).toHaveLength(5)
    expect(noHallCensus.every((x) => x.brand === 'skcinemas')).toBe(true)
    expect(work.every((x) => !('seatPositions' in x) && !x.seatGridVerified)).toBe(true)
  })

  it('does not equate published Shin Kong venue-wide hall totals with individual seat grids', () => {
    expect(cinemaPublishedFacts['skcinemas-taipei-shizilin']).toMatchObject({
      hallCount: 3,
      hallCountScope: 'entire-cinema',
      publishedSeatCount: 939,
    })
    expect(cinemaPublishedFacts['skcinemas-taoyuan-qingpu']).toMatchObject({
      hallCount: 12,
      hallCountScope: 'entire-cinema',
      publishedSeatCount: 1900,
    })
    expect(miranewPatterns.layouts.filter((x) => x.cinemaSlug === 'miranew-taimall')).toHaveLength(
      8,
    )
    expect(
      miranewPatterns.layouts.filter((x) => x.cinemaSlug === 'miranew-dazhi-royal'),
    ).toHaveLength(5)
    expect(miranewPatterns.layouts.every((x) => x.physicalHallNumber === null)).toBe(true)
    // 223 remaining published capacities + 24 Vie Show unmatched halls + 3 Tai-Mall
    // operator halls without a public chart = 250 *source record gaps*,
    // NOT 250 verified operating physical auditoriums.
    expect(223 + vieShowCoverage.totals.missingOfficialEntries + (11 - 8)).toBe(250)
  })
})
