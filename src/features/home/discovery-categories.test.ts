import { describe, expect, it } from 'vitest'
import { chainCinemas } from '../cinemas/chain-directory'
import {
  culturalCinemaHalls,
  culturalCinemaVenueCount,
  includesCinemaCategory,
  searchChainCinemaVenues,
  searchCulturalCinemaHalls,
} from './discovery-categories'
import { directoryHallRoute } from '../cinemas/hall-navigation'

describe('shared discovery categories with chain cinemas first', () => {
  it('integrates five cultural/independent venues and nine halls without duplicating Vie Show', () => {
    expect(chainCinemas).toHaveLength(40)
    expect(culturalCinemaVenueCount).toBe(5)
    expect(culturalCinemaHalls).toHaveLength(9)
    expect(new Set(culturalCinemaHalls.map((hall) => hall.cinemaSlug)).size).toBe(5)
    expect(culturalCinemaHalls.some((hall) => hall.slug === 'vieshow-hsinyi-12')).toBe(false)
    const chainVenueSlugs = new Set(chainCinemas.map((cinema) => cinema.slug))
    expect(culturalCinemaHalls.every((hall) => !chainVenueSlugs.has(hall.cinemaSlug))).toBe(true)
  })

  it('uses one category control to show all, only chain, or only cultural entries', () => {
    expect(
      ['chain', 'cultural'].filter((category) =>
        includesCinemaCategory('all', category as 'chain' | 'cultural'),
      ),
    ).toEqual(['chain', 'cultural'])
    expect(includesCinemaCategory('chain', 'chain')).toBe(true)
    expect(includesCinemaCategory('chain', 'cultural')).toBe(false)
    expect(includesCinemaCategory('cultural', 'cultural')).toBe(true)
    expect(includesCinemaCategory('cultural', 'chain')).toBe(false)
  })

  it('shares text, city and available-3D filters across both categories', () => {
    expect(searchChainCinemaVenues('', 'all', 'all')).toHaveLength(40)
    expect(searchChainCinemaVenues('', 'all', '3d')).toHaveLength(22)
    expect(searchChainCinemaVenues('', 'all', 'information')).toHaveLength(18)
    expect(searchChainCinemaVenues('', 'all', '3d', 'vieshow')).toHaveLength(22)
    expect(searchChainCinemaVenues('', 'all', '3d', 'showtime')).toHaveLength(0)

    expect(searchCulturalCinemaHalls('', 'all', 'all')).toHaveLength(9)
    expect(
      searchCulturalCinemaHalls('', 'all', '3d')
        .map((hall) => hall.slug)
        .sort(),
    ).toEqual(['spot-taipei', 'tfai-small'])
    expect(searchCulturalCinemaHalls('', 'all', 'information')).toHaveLength(7)
    expect(searchCulturalCinemaHalls('光點', 'all', 'all')).toHaveLength(3)
    expect(searchCulturalCinemaHalls('國影中心', '新北市', 'all')).toHaveLength(2)
    expect(searchCulturalCinemaHalls('國影中心', '高雄市', 'all')).toHaveLength(0)
    expect(searchCulturalCinemaHalls('信義威秀', 'all', 'all')).toHaveLength(0)
  })

  it('retains sourced cultural seat-view routes and information-only routes', () => {
    const bySlug = (slug: string) => culturalCinemaHalls.find((hall) => hall.slug === slug)!
    expect(directoryHallRoute(bySlug('tfai-small'))).toBe('/auditoriums/tfai-small')
    expect(directoryHallRoute(bySlug('spot-taipei'))).toBe('/auditoriums/spot-taipei')
    expect(directoryHallRoute(bySlug('tfai-big'))).toBe('/directory/tfai-big')
    expect(culturalCinemaHalls.every((hall) => hall.sourceUrls.length > 0)).toBe(true)
  })
})
