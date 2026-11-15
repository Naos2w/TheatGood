import { describe, expect, it } from 'vitest'
import { cinemaDirectory, searchCinemaDirectory } from './directory'
import { cinemaLocations, distanceKm, distanceToCinemaKm, sortHallsByDistance } from './proximity'

describe('nearby cinema discovery', () => {
  it('has one sourced position per cinema, without mixing venues and auditoriums', () => {
    expect(Object.keys(cinemaLocations)).toHaveLength(5)
    expect(new Set(cinemaDirectory.map((hall) => hall.cinemaSlug))).toEqual(
      new Set(Object.keys(cinemaLocations)),
    )
    for (const location of Object.values(cinemaLocations)) {
      expect(location.address).toBeTruthy()
      expect(location.sourceUrl).toMatch(/^https:\/\//)
      expect(location.latitude).toBeGreaterThan(21)
      expect(location.latitude).toBeLessThan(26)
      expect(location.longitude).toBeGreaterThan(119)
      expect(location.longitude).toBeLessThan(123)
    }
  })

  it('calculates straight-line distance symmetrically, including zero', () => {
    const a = cinemaLocations['spot-taipei']!
    const b = cinemaLocations['spot-huashan']!
    expect(distanceKm(a, a)).toBeCloseTo(0)
    expect(distanceKm(a, b)).toBeCloseTo(distanceKm(b, a))
    expect(distanceKm(a, b)).toBeGreaterThan(0.5)
    expect(distanceKm(a, b)).toBeLessThan(3)
  })

  it('sorts all nine auditoriums across 3D-ready and directory-only entries', () => {
    const origin = { latitude: 22.622435, longitude: 120.28878 }
    const original = [...cinemaDirectory]
    const sorted = sortHallsByDistance(original, origin)

    expect(sorted).toHaveLength(9)
    expect(sorted.slice(0, 2).map((hall) => hall.slug)).toEqual(['kfa-3f', 'kfa-2f'])
    expect(sorted.slice(2, 4).map((hall) => hall.slug)).toEqual(['nwac-reel-one', 'nwac-reel-two'])
    expect(original).toEqual(cinemaDirectory)
    expect(distanceToCinemaKm(sorted[0]!, origin)).toBeCloseTo(0)
  })

  it('keeps search filters, stable same-venue ordering, and unknown venues', () => {
    const origin = cinemaLocations['spot-taipei']!
    const spot = sortHallsByDistance(searchCinemaDirectory('光點'), origin)
    expect(spot.map((hall) => hall.slug)).toEqual([
      'spot-taipei',
      'spot-huashan-a-one',
      'spot-huashan-a-two',
    ])
    const unknown = { ...cinemaDirectory[0]!, slug: 'new-hall', cinemaSlug: 'unlocated' }
    expect(sortHallsByDistance([unknown, cinemaDirectory[2]!], origin)[1]?.slug).toBe('new-hall')
    expect(distanceToCinemaKm(unknown, origin)).toBeUndefined()
  })
})
