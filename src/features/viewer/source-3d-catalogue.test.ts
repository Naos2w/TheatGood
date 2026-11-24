import { describe, expect, it } from 'vitest'
import { chainCinemas } from '../cinemas/chain-directory'
import { miranewSeatReferences } from '../cinemas/official-seat-layouts'
import { broadwayPublicSeatLayouts } from '../cinemas/broadway-seat-layouts'
import { loadVieShowArchiveForCinema } from '../cinemas/vieshow-seat-archive'
import type { ShowtimeLocalResearchIndex } from './showtime-local-research'
import {
  miranewSource3DEntries,
  broadwaySource3DEntries,
  centuryasiaSource3DEntries,
  pendingChain3DVenues,
  showtimeSource3DEntries,
  source3DTotalByBrand,
  source3DVenues,
  vieShowSource3DEntries,
} from './source-3d-catalogue'

describe('source-verified 3D catalogue', () => {
  it('lists chain cinema seating only, without adding non-chain or capacity-only venues', () => {
    const venues = source3DVenues()
    expect(venues.filter((v) => v.brand === 'vieshow')).toHaveLength(22)
    expect(venues.filter((v) => v.brand === 'showtime')).toHaveLength(15)
    expect(venues.filter((v) => v.brand === 'miranew')).toHaveLength(2)
    expect(venues.filter((v) => v.brand === 'broadway')).toHaveLength(2)
    expect(venues.filter((v) => v.brand === 'centuryasia')).toHaveLength(2)
    expect(venues).toHaveLength(43)
    expect(source3DTotalByBrand(venues, 'vieshow')).toBe(222)
    expect(source3DTotalByBrand(venues, 'miranew')).toBe(13)
    expect(source3DTotalByBrand(venues, 'broadway')).toBe(3)
    expect(source3DTotalByBrand(venues, 'centuryasia')).toBe(8)
    expect(source3DTotalByBrand(venues, 'showtime')).toBeNull()
    expect(venues.every((v) => chainCinemas.some((cinema) => cinema.slug === v.slug))).toBe(true)
    expect(
      venues.some((v) => ['spot-taipei', 'tfai-small', 'miramar-dazhi'].includes(v.slug)),
    ).toBe(false)
    expect(venues.every((v) => v.evidence !== ('curated-auditorium' as never))).toBe(true)
    expect(venues.every((v) => !v.key.startsWith('independent|'))).toBe(true)
    expect(pendingChain3DVenues()).toHaveLength(23)
    expect(pendingChain3DVenues().filter((v) => v.checkedAt === '2026-11-18')).toHaveLength(22)
    expect(pendingChain3DVenues().some((v) => v.slug === 'miramar-dazhi')).toBe(true)
    expect(
      pendingChain3DVenues().every((v) => !venues.some((ready) => ready.slug === v.slug)),
    ).toBe(true)
    expect(venues.some((venue) => venue.slug === 'miramar-dazhi')).toBe(false)
  })

  it('makes 222 real VieShow source-layout links for the exact archived diagrams', async () => {
    const cinemas = chainCinemas.filter((item) => item.brand === 'vieshow')
    const groups = await Promise.all(
      cinemas.map(async (cinema) => ({
        slug: cinema.slug,
        items: vieShowSource3DEntries(cinema.slug, await loadVieShowArchiveForCinema(cinema.slug)),
      })),
    )
    expect(groups.reduce((count, group) => count + group.items.length, 0)).toBe(222)
    const keys = groups.flatMap((group) =>
      group.items.map((item) => {
        expect(item.count).toBeGreaterThan(0)
        expect(item.path).toContain('/cinemas/' + group.slug + '/halls/')
        expect(item.type).toBe('source-hall')
        expect(item.id.length).toBeGreaterThan(4)
        return group.slug + '|' + item.id
      }),
    )
    expect(new Set(keys).size).toBe(222)
  })

  it('adds three distinct public Broadway previews in two branches', () => {
    expect(broadwayPublicSeatLayouts.map((l) => l.id).sort()).toEqual([
      'broadway-gongguan-10',
      'broadway-zhubei-10',
      'broadway-zhubei-7',
    ])
    const paths = ['broadway-gongguan', 'broadway-zhubei'].flatMap((slug) =>
      broadwaySource3DEntries(slug),
    )
    expect(paths).toHaveLength(3)
    expect(paths.map((item) => item.count).sort((a, b) => a - b)).toEqual([29, 42, 75])
    expect(paths.every((item) => item.path.includes('/halls/broadway-'))).toBe(true)
  })

  it('offers eight verified Century Asia halls, without claiming other halls', () => {
    const entries = ['centuryasia-nangang', 'centuryasia-yonghe'].flatMap(
      centuryasiaSource3DEntries,
    )
    expect(entries.map((e) => e.count)).toEqual([48, 48, 43, 48, 37, 50, 38, 50])
    expect(entries.map((e) => e.id)).toEqual([
      'centuryasia-nangang-5',
      'centuryasia-nangang-18',
      'centuryasia-nangang-23',
      'centuryasia-nangang-24',
      'centuryasia-yonghe-12',
      'centuryasia-yonghe-3',
      'centuryasia-yonghe-13',
      'centuryasia-yonghe-2',
    ])
    expect(entries.every((e) => e.path.includes('/halls/centuryasia-'))).toBe(true)
  })

  it('offers all 13 observed Miranew patterns without claiming permanent halls', () => {
    const entrances = ['miranew-taimall', 'miranew-dazhi-royal'].flatMap((slug) =>
      miranewSource3DEntries(slug),
    )
    expect(entrances).toHaveLength(13)
    expect(new Set(entrances.map((item) => item.id)).size).toBe(13)
    expect(entrances.reduce((total, item) => total + item.count, 0)).toBe(1531)
    for (const item of entrances) {
      expect(item.type).toBe('observed-pattern')
      expect(item.path).toContain('/seat-patterns/')
      const source = miranewSeatReferences.find((pattern) => pattern.id === item.id)
      expect(source?.physicalHallNumber).toBeNull()
      expect(source?.totalSeatLabels).toBe(item.count)
    }
  })

  it('shows private Showtime halls only when exact authorised source index is available', () => {
    const allHalls = Object.fromEntries(
      chainCinemas
        .filter((item) => item.brand === 'showtime')
        .map((cinema) => [
          cinema.slug,
          cinema.slug === 'showtime-taitung'
            ? [
                {
                  hallLabel: '2廳',
                  ordinarySeatCount: 89,
                  rowsCount: 8,
                  observedAt: '2026-11-21T01:00:00Z',
                  researchedOnly: true,
                  physicallyMeasured: false,
                },
              ]
            : [],
        ]),
    )
    const index = {
      localDeviceOnly: true,
      researchOnly: true,
      approvedForPublicUI: false,
      sampledHallLabels: 159,
      verifiedHallLabels: 1,
      missingHallLabels: 158,
      venues: allHalls,
    } as unknown as ShowtimeLocalResearchIndex
    expect(showtimeSource3DEntries('showtime-taitung', null)).toEqual([])
    expect(
      showtimeSource3DEntries('showtime-taitung', {
        ...index,
        approvedForPublicUI: true,
      } as unknown as ShowtimeLocalResearchIndex),
    ).toEqual([])
    const entries = showtimeSource3DEntries('showtime-taitung', index)
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      id: 'showtime-taitung|2廳',
      count: 89,
      path: '/cinemas/showtime-taitung/halls/' + encodeURIComponent('2廳'),
    })
    expect(source3DTotalByBrand(source3DVenues(index), 'showtime')).toBe(1)
  })
})
