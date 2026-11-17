import {
  cinemaDirectory,
  searchCinemaDirectory,
  type DirectoryHall,
} from '../auditoriums/directory'
import {
  chainCinemas,
  searchChainCinemas,
  type ChainBrand,
  type ChainCinema,
} from '../cinemas/chain-directory'
import { vieShowCoverageForCinema } from '../cinemas/vieshow-seat-archive'

export type CinemaDiscoveryCategory = 'all' | 'chain' | 'cultural'
export type CinemaDiscoveryModelFilter = 'all' | '3d' | 'information'

const chainVenueSlugs = new Set(chainCinemas.map((cinema) => cinema.slug))

/**
 * Keep cultural and independent cinemas in the SAME public discovery flow,
 * without duplicating the historical Hsin Yi Vie Show model as a cultural hall.
 */
export const culturalCinemaHalls: readonly DirectoryHall[] = cinemaDirectory.filter(
  (hall) => !chainVenueSlugs.has(hall.cinemaSlug),
)
export const culturalCinemaVenueCount = new Set(culturalCinemaHalls.map((hall) => hall.cinemaSlug))
  .size

export function searchCulturalCinemaHalls(
  query: string,
  city: string,
  modelFilter: CinemaDiscoveryModelFilter,
): DirectoryHall[] {
  return searchCinemaDirectory(query).filter(
    (hall) =>
      !chainVenueSlugs.has(hall.cinemaSlug) &&
      (city === 'all' || hall.city === city) &&
      (modelFilter === 'all' || (modelFilter === '3d' ? Boolean(hall.modelId) : !hall.modelId)),
  )
}

export function searchChainCinemaVenues(
  query: string,
  city: string,
  modelFilter: CinemaDiscoveryModelFilter,
  brand: ChainBrand | 'all' = 'all',
): ChainCinema[] {
  return searchChainCinemas(query, brand, city).filter((cinema) => {
    const has3d = Boolean(vieShowCoverageForCinema(cinema.slug)?.observedLabels)
    return modelFilter === 'all' || (modelFilter === '3d' ? has3d : !has3d)
  })
}

export function includesCinemaCategory(
  selected: CinemaDiscoveryCategory,
  candidate: Exclude<CinemaDiscoveryCategory, 'all'>,
): boolean {
  return selected === 'all' || selected === candidate
}
