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
import {
  cinemaHasFormat,
  venuePrimaryLabel,
  type AuditoriumFormatFilter,
} from '../cinemas/cinema-discovery-metadata'

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
  format: AuditoriumFormatFilter,
  brand: ChainBrand | 'all' = 'all',
): ChainCinema[] {
  // Public discovery is for choosing a SEAT, not browsing cinema descriptions.
  // Don't surface operator branches without a verified, usable seat chart.
  const term = query
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, '')
  return searchChainCinemas('', brand, city).filter(
    (cinema) =>
      Boolean(vieShowCoverageForCinema(cinema.slug)?.observedLabels) &&
      cinemaHasFormat(cinema.slug, format) &&
      (!term ||
        [cinema.name, cinema.address, cinema.city, venuePrimaryLabel(cinema)].some((field) =>
          field
            .normalize('NFKC')
            .toLocaleLowerCase()
            .replace(/[\s\p{P}\p{S}]+/gu, '')
            .includes(term),
        )),
  )
}

export function includesCinemaCategory(
  selected: CinemaDiscoveryCategory,
  candidate: Exclude<CinemaDiscoveryCategory, 'all'>,
): boolean {
  return selected === 'all' || selected === candidate
}
