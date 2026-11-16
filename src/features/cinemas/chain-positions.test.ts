import { describe, expect, it } from 'vitest'
import { chainCinemas } from './chain-directory'
import { chainDistanceKm, sortChainsByDistance, verifiedChainPositions } from './chain-positions'

describe('sourced commercial cinema proximity', () => {
  it('coordinates are supported OSM features for an existing venue only', () => {
    const slugs = new Set(chainCinemas.map((cinema) => cinema.slug))
    expect(Object.keys(verifiedChainPositions)).toHaveLength(36)
    for (const [slug, position] of Object.entries(verifiedChainPositions)) {
      expect(slugs.has(slug)).toBe(true)
      expect(position.sourceUrl).toMatch(/^https:\/\/www\.openstreetmap\.org\/(?:node|way)\/\d+$/)
      expect(['cinema', 'site']).toContain(position.precision)
      expect(position.latitude).toBeGreaterThan(21.8)
      expect(position.latitude).toBeLessThan(25.5)
      expect(position.longitude).toBeGreaterThan(119.4)
      expect(position.longitude).toBeLessThan(122.15)
    }
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
    expect(sorted.slice(0, 36).every((cinema) => verifiedChainPositions[cinema.slug])).toBe(true)
    expect(sorted.slice(36).every((cinema) => !verifiedChainPositions[cinema.slug])).toBe(true)
  })

  it('returns undefined for unsourced points and stable ties for same location', () => {
    const unknown = chainCinemas.find((cinema) => cinema.slug === 'vieshow-taipei-ximen')!
    const known = chainCinemas.find((cinema) => cinema.slug === 'miramar-dazhi')!
    const origin = { latitude: 25.08328, longitude: 121.55746 }
    expect(chainDistanceKm(unknown, origin)).toBeUndefined()
    expect(chainDistanceKm(known, origin)).toBe(0)
    expect(sortChainsByDistance([unknown, known, unknown], origin).map((x) => x.slug)).toEqual([
      'miramar-dazhi',
      'vieshow-taipei-ximen',
      'vieshow-taipei-ximen',
    ])
  })
})
