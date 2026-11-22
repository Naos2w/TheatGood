import { describe, expect, it } from 'vitest'
import { chainCinemas } from '../cinemas/chain-directory'
import { vieShowCoverageForCinema } from '../cinemas/vieshow-seat-archive'
import {
  verifiedFormatsForCinema,
  cinemaHasFormat,
  venueBrandLabel,
  venueBrandVariant,
  venuePrimaryLabel,
} from '../cinemas/cinema-discovery-metadata'
import {
  culturalCinemaHalls,
  culturalCinemaVenueCount,
  cinemaHasVerifiedSeatMap,
  searchChainCinemaVenues,
  searchCulturalCinemaHalls,
} from './discovery-categories'
import { directoryHallRoute } from '../cinemas/hall-navigation'

describe('cinema-only public discovery, with retained cultural source data', () => {
  it('discovers all 66 researched chain venues, keeping 26 newer branches information-only', () => {
    expect(chainCinemas).toHaveLength(66)
    const discoverable = searchChainCinemaVenues('', 'all', 'all')
    expect(discoverable).toHaveLength(66)
    expect(discoverable.filter((cinema) => cinemaHasVerifiedSeatMap(cinema.slug))).toHaveLength(22)
    expect(discoverable.filter((cinema) => !cinemaHasVerifiedSeatMap(cinema.slug))).toHaveLength(44)
    expect(searchChainCinemaVenues('', 'all', 'all', 'vieshow')).toHaveLength(22)
    expect(searchChainCinemaVenues('', 'all', 'all', 'showtime')).toHaveLength(15)
    expect(searchChainCinemaVenues('', 'all', 'all', 'miranew')).toHaveLength(2)
    expect(searchChainCinemaVenues('', 'all', 'all', 'miramar')).toHaveLength(1)
    expect(searchChainCinemaVenues('', 'all', 'all', 'ambassador')).toHaveLength(9)
    expect(searchChainCinemaVenues('', 'all', 'all', 'in89')).toHaveLength(6)
    expect(searchChainCinemaVenues('', 'all', 'all', 'broadway')).toHaveLength(2)
    expect(searchChainCinemaVenues('', 'all', 'all', 'centuryasia')).toHaveLength(4)
    expect(searchChainCinemaVenues('', 'all', 'all', 'skcinemas')).toHaveLength(5)

    const modelled = searchChainCinemaVenues('', 'all', 'all', 'all', '3d')
    const information = searchChainCinemaVenues('', 'all', 'all', 'all', 'information')
    expect(modelled).toHaveLength(22)
    expect(
      modelled.every((cinema) => (vieShowCoverageForCinema(cinema.slug)?.observedLabels ?? 0) > 0),
    ).toBe(true)
    expect(information).toHaveLength(44)
    expect(information.every((cinema) => !cinemaHasVerifiedSeatMap(cinema.slug))).toBe(true)
    expect(searchChainCinemaVenues('', 'all', 'all', 'showtime', '3d')).toHaveLength(0)
    expect(searchChainCinemaVenues('', 'all', 'all', 'showtime', 'information')).toHaveLength(15)
    expect(searchChainCinemaVenues('宏匯', 'all', 'all')).toHaveLength(0)
    expect(searchChainCinemaVenues('SCREENX', 'all', 'all', 'showtime').length).toBeGreaterThan(1)
  })

  it('filters only source-backed permanent branch formats, never guessed hall identities', () => {
    expect(searchChainCinemaVenues('', 'all', 'imax')).toHaveLength(8)
    expect(searchChainCinemaVenues('', 'all', '4dx')).toHaveLength(6)
    expect(searchChainCinemaVenues('', 'all', 'giant')).toHaveLength(2)
    expect(verifiedFormatsForCinema('vieshow-muvie-taichung-tigercity')).toEqual(['giant'])
    expect(verifiedFormatsForCinema('vieshow-hsinchu-bigcity')).toEqual(['imax'])
    expect(verifiedFormatsForCinema('vieshow-taipei-hsinyi')).toEqual(['4dx'])
    expect(verifiedFormatsForCinema('vieshow-muvie-taipei-a13')).toEqual(['giant'])
    expect(verifiedFormatsForCinema('vieshow-taipei-qsquare')).toEqual([])
    expect(cinemaHasFormat('vieshow-taipei-qsquare', 'imax')).toBe(false)
  })

  it('searches mall names and regions, with mall-first labels rather than branding', () => {
    const giantCity = searchChainCinemaVenues('Big City', 'all', 'all')
    expect(giantCity.map((cinema) => cinema.slug)).toEqual(['vieshow-hsinchu-bigcity'])
    expect(venuePrimaryLabel(giantCity[0]!)).toContain('巨城')
    expect(searchChainCinemaVenues('南紡', 'all', 'all')).toHaveLength(1)
    expect(searchChainCinemaVenues('', '臺北市', 'all').length).toBeGreaterThan(1)
    expect(searchChainCinemaVenues('', '新竹市', 'imax').map((cinema) => cinema.slug)).toEqual([
      'vieshow-hsinchu-bigcity',
    ])
    const muvie = chainCinemas.find((cinema) => cinema.slug === 'vieshow-muvie-taipei-a13')!
    expect(venueBrandVariant(muvie)).toBe('muvie')
    expect(venueBrandLabel(muvie)).toBe('MUVIE')
    expect(venuePrimaryLabel(muvie)).toContain('A13')
    expect(
      venuePrimaryLabel(chainCinemas.find((cinema) => cinema.slug === 'vieshow-taipei-hsinyi')!),
    ).toContain('信義')
  })

  it('keeps existing cultural models and source-only halls accessible by direct route, but not in the homepage discovery', () => {
    expect(culturalCinemaVenueCount).toBe(5)
    expect(culturalCinemaHalls).toHaveLength(9)
    const bySlug = (slug: string) => culturalCinemaHalls.find((hall) => hall.slug === slug)!
    expect(directoryHallRoute(bySlug('tfai-small'))).toBe('/auditoriums/tfai-small')
    expect(directoryHallRoute(bySlug('spot-taipei'))).toBe('/auditoriums/spot-taipei')
    expect(directoryHallRoute(bySlug('tfai-big'))).toBe('/directory/tfai-big')
    expect(
      searchCulturalCinemaHalls('', 'all', '3d')
        .map((h) => h.slug)
        .sort(),
    ).toEqual(['spot-taipei', 'tfai-small'])
  })
})
