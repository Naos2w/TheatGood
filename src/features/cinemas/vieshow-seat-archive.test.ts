import { describe, expect, it } from 'vitest'
import { chainCinemas } from './chain-directory'
import { publishedVieshowHalls } from './vieshow-halls'
import {
  loadVieShowArchiveForCinema,
  validateVieShowVenueSnapshot,
  vieShowArchiveSummary,
  vieShowArchivedHallFact,
  vieShowCoverageForCinema,
  type VieShowVenueSnapshot,
} from './vieshow-seat-archive'

describe('sourced Vie Show/MUVIE public seat grid archive', () => {
  const allVenues = chainCinemas.filter((venue) => venue.brand === 'vieshow')

  it('reports exactly 22 locations, 205 of 229 numbered halls and all discrepancies', () => {
    expect(allVenues).toHaveLength(22)
    expect(vieShowArchiveSummary).toMatchObject({
      venues: 22,
      officialEntries: 229,
      matchedOfficialEntries: 205,
      missingOfficialEntries: 24,
      layouts: 222,
      exact: 187,
      differing: 18,
      unknown: 17,
      conflictingObservations: 0,
    })
    for (const venue of allVenues) {
      const coverage = vieShowCoverageForCinema(venue.slug)
      expect(coverage).toBeDefined()
      expect(coverage!.matchedPublishedHalls + coverage!.missingOfficialHalls.length).toBe(
        coverage!.publishedHalls,
      )
    }
  })

  it('lazily loads and validates each venue without losing actual grid cells', async () => {
    const results = await Promise.all(
      allVenues.map(async (venue) => {
        const layouts = await loadVieShowArchiveForCinema(venue.slug)
        const coverage = vieShowCoverageForCinema(venue.slug)!
        expect(layouts.length).toBe(coverage.observedLabels)
        expect(new Set(layouts.map((layout) => layout.id)).size).toBe(layouts.length)
        for (const layout of layouts) {
          expect(layout.ordinarySeatCount).toBe(layout.seatPositions.length)
          expect(layout.wheelchairMarkers).toBe(layout.wheelchairPositions.length)
          expect(layout.snapshotSource).toContain(
            'https://sales.vscinemas.com.tw/VoucherTicketing/SessionSeats.aspx?',
          )
          expect(layout).not.toHaveProperty('availableSeats')
          expect(layout).not.toHaveProperty('soldSeats')
          expect(layout).not.toHaveProperty('ticketPrice')
          expect(layout).not.toHaveProperty('screenWidthM')
          expect(layout).not.toHaveProperty('modelId')
        }
        return layouts.length
      }),
    )
    expect(results.reduce((sum, count) => sum + count, 0)).toBe(222)
    expect(await loadVieShowArchiveForCinema('miranew-taimall')).toEqual([])
  })

  it('preserves numeric labels and alphabetic hall codes exactly as observed', async () => {
    const ximen = await loadVieShowArchiveForCinema('vieshow-taipei-ximen')
    expect(ximen.some((layout) => layout.seatPositions.some(([label]) => label === '113'))).toBe(
      true,
    )
    const hualien = await loadVieShowArchiveForCinema('vieshow-hualien-paradiso')
    expect(hualien.some((layout) => layout.hallLabel === '第C廳')).toBe(true)
    expect(hualien.every((layout) => layout.hallNumber === null)).toBe(true)
    const tainan = await loadVieShowArchiveForCinema('vieshow-tainan-tsmall')
    expect(tainan.some((layout) => layout.hallNumber === 25)).toBe(true)
    expect(tainan.some((layout) => layout.hallLabel.includes('GC'))).toBe(true)
    expect(vieShowArchivedHallFact('vieshow-taipei-hsinyi', '6')?.ordinarySeatCount).toBe(150)
    expect(vieShowArchivedHallFact('vieshow-taipei-hsinyi', '11')?.ordinarySeatCount).toBe(254)
    expect(vieShowArchivedHallFact('vieshow-taipei-hsinyi', '13')).toBeUndefined()
  })

  it('does not silently treat an ambiguous or mismatched hall as verified', async () => {
    const taichung = await loadVieShowArchiveForCinema('vieshow-taichung-topcity')
    const mismatched = taichung.find((item) => item.hallNumber === 1)!
    expect(mismatched.countComparison).toBe('different')
    expect(mismatched.ordinarySeatCount).toBe(325)
    expect(mismatched.publishedSeatCount).toBe(389)
    expect(vieShowArchivedHallFact('vieshow-taichung-topcity', '1')?.countComparison).toBe(
      'different',
    )
    const hsinchu = vieShowCoverageForCinema('vieshow-hsinchu-fe21')!
    expect(hsinchu.missingOfficialHalls).toEqual([17, 19])
    expect(
      publishedVieshowHalls.filter((item) => item.cinemaSlug === 'vieshow-hsinchu-fe21'),
    ).toHaveLength(11)
  })

  it('rejects a corrupted seat placement, forged source or unsupported capacity', async () => {
    const slug = 'vieshow-taipei-hsinyi'
    const original = await loadVieShowArchiveForCinema(slug)
    const base: VieShowVenueSnapshot = {
      schemaVersion: 2,
      venueSlug: slug,
      observedAt: '2026-11-16',
      sourceType: 'Vie Show public SessionSeats.aspx, read-only',
      caveat: 'reference only',
      layouts: structuredClone(original) as VieShowVenueSnapshot['layouts'],
    }
    expect(() => validateVieShowVenueSnapshot(base, slug)).not.toThrow()
    const badSource = structuredClone(base)
    badSource.layouts[0]!.snapshotSource =
      'https://example.org/VoucherTicketing/SessionSeats.aspx?CinemaCode=1&txtSessionId=1234'
    expect(() => validateVieShowVenueSnapshot(badSource, slug)).toThrow(/source|capacity/)
    const overlapping = structuredClone(base)
    overlapping.layouts[0]!.seatPositions[0] = [...overlapping.layouts[0]!.seatPositions[1]!]
    expect(() => validateVieShowVenueSnapshot(overlapping, slug)).toThrow(/overlap|label/)
    const wrongTotal = structuredClone(base)
    wrongTotal.layouts[0]!.publishedSeatCount = 3
    expect(() => validateVieShowVenueSnapshot(wrongTotal, slug)).toThrow(/capacity/)
  })
})
