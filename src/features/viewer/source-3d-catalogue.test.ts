import { describe, expect, it } from 'vitest'
import { chainCinemas } from '../cinemas/chain-directory'
import { miranewSeatReferences } from '../cinemas/official-seat-layouts'
import { loadVieShowArchiveForCinema } from '../cinemas/vieshow-seat-archive'
import type { ShowtimeLocalResearchIndex } from './showtime-local-research'
import {
  independentSource3DEntries,
  miranewSource3DEntries,
  showtimeSource3DEntries,
  source3DTotalByBrand,
  source3DVenues,
  vieShowSource3DEntries,
} from './source-3d-catalogue'

describe('source-verified 3D catalogue', () => {
  it('lists every sourced brand, excludes capacities without seat grid and avoids duplicate curated halls', () => {
    const venues = source3DVenues()
    expect(venues.filter((v) => v.brand === 'vieshow')).toHaveLength(22)
    expect(venues.filter((v) => v.brand === 'showtime')).toHaveLength(15)
    expect(venues.filter((v) => v.brand === 'miranew')).toHaveLength(2)
    expect(venues.filter((v) => v.brand === 'independent')).toHaveLength(2)
    expect(source3DTotalByBrand(venues, 'vieshow')).toBe(222)
    expect(source3DTotalByBrand(venues, 'miranew')).toBe(13)
    expect(source3DTotalByBrand(venues, 'independent')).toBe(2)
    expect(source3DTotalByBrand(venues, 'showtime')).toBeNull()
    expect(venues.every((v) => v.brand !== ('miramar' as never))).toBe(true)
    expect(
      venues
        .filter((v) => v.brand === 'independent')
        .map((v) => v.slug)
        .sort(),
    ).toEqual(['spot-taipei', 'tfai-small'])
    expect(independentSource3DEntries('vieshow-hsinyi-12')).toEqual([])
    expect(independentSource3DEntries('tfai-small')).toHaveLength(1)
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
