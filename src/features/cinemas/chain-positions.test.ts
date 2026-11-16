import { describe, expect, it } from 'vitest'
import { chainCinemas } from './chain-directory'
import { chainDistanceKm, sortChainsByDistance, verifiedChainPositions } from './chain-positions'

describe('sourced commercial cinema proximity', () => {
  it('coordinates have traceable per-location sources for every current venue', () => {
    const slugs = new Set(chainCinemas.map((cinema) => cinema.slug))
    expect(Object.keys(verifiedChainPositions)).toHaveLength(40)
    for (const [slug, position] of Object.entries(verifiedChainPositions)) {
      expect(slugs.has(slug)).toBe(true)
      expect(position.sourceUrl).toMatch(/^https:\/\//)
      if (slug === 'vieshow-tainan-fe21') {
        expect(position.sourceUrl).toBe(
          'https://www.vrwalker.net/tw/print.php?serno=222&tbname=scenerys',
        )
        expect(position.precision).toBe('site')
      } else {
        expect(position.sourceUrl).toMatch(/^https:\/\/www\.openstreetmap\.org\/(?:node|way)\/\d+$/)
      }
      expect(['cinema', 'site']).toContain(position.precision)
      expect(position.latitude).toBeGreaterThan(21.8)
      expect(position.latitude).toBeLessThan(25.5)
      expect(position.longitude).toBeGreaterThan(119.4)
      expect(position.longitude).toBeLessThan(122.15)
    }
  })

  it('covers the four last branches with matched building or cinema points', () => {
    expect(verifiedChainPositions['vieshow-taipei-ximen']).toMatchObject({
      latitude: 25.04378,
      longitude: 121.50717,
      precision: 'site',
    })
    expect(verifiedChainPositions['vieshow-tainan-fe21']).toMatchObject({
      latitude: 22.995131,
      longitude: 120.20568,
      precision: 'site',
    })
    expect(verifiedChainPositions['showtime-yunlin-beigang']).toMatchObject({
      latitude: 23.57008,
      longitude: 120.29928,
      precision: 'cinema',
    })
    expect(verifiedChainPositions['showtime-taichung-lipao']).toMatchObject({
      latitude: 24.32652,
      longitude: 120.70196,
      precision: 'site',
    })
  })

  it('sorts by kilometres without dropping unlocated venues or mutating input', () => {
    const original = [...chainCinemas]
    const origin = { latitude: 25.05415, longitude: 121.52599 }
    const sorted = sortChainsByDistance(original, origin)
    expect(sorted).toHaveLength(40)
    expect(sorted[0]?.slug).toBe('showtime-taipei-xinxin')
    expect(chainDistanceKm(sorted[0]!, origin)).toBeCloseTo(0)
    expect(new Set(sorted.map((item) => item.slug)).size).toBe(40)
    expect(original).toEqual(chainCinemas)
    expect(sorted.every((cinema) => verifiedChainPositions[cinema.slug])).toBe(true)
  })

  it('returns undefined for new unsourced venues, preserving them at the end', () => {
    const unknown = { ...chainCinemas[0]!, slug: 'new-unsourced-venue' }
    const known = chainCinemas.find((cinema) => cinema.slug === 'miramar-dazhi')!
    const origin = { latitude: 25.08328, longitude: 121.55746 }
    expect(chainDistanceKm(unknown, origin)).toBeUndefined()
    expect(chainDistanceKm(known, origin)).toBe(0)
    expect(sortChainsByDistance([unknown, known, unknown], origin).map((x) => x.slug)).toEqual([
      'miramar-dazhi',
      'new-unsourced-venue',
      'new-unsourced-venue',
    ])
  })
})
