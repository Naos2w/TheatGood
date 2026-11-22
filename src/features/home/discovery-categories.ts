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
import { cinemaPublishedFacts } from '../cinemas/other-chain-facts'
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

export function cinemaHasVerifiedSeatMap(slug: string): boolean {
  return (vieShowCoverageForCinema(slug)?.observedLabels ?? 0) > 0
}

function cinemaMatchesVerifiedFormat(slug: string, format: AuditoriumFormatFilter): boolean {
  if (cinemaHasFormat(slug, format)) return true
  // The other operators have branch-level format facts, not a numbered seat map.
  // "Giant" stays limited to explicitly sourced TITAN, not other giant-screen brands.
  const advertised = cinemaPublishedFacts[slug]?.namedFormats ?? []
  if (format === 'imax') return advertised.some((name) => name.toUpperCase() === 'IMAX')
  if (format === '4dx') return advertised.some((name) => name.toUpperCase().includes('4DX'))
  return false
}

/** Discover every sourced chain venue. Availability of a 2D/3D seating
 * model is an explicit filter, never a prerequisite for appearing in search. */
export function searchChainCinemaVenues(
  query: string,
  city: string,
  format: AuditoriumFormatFilter,
  brand: ChainBrand | 'all' = 'all',
  modelFilter: CinemaDiscoveryModelFilter = 'all',
): ChainCinema[] {
  const term = query
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, '')
  return searchChainCinemas('', brand, city).filter((cinema) => {
    const modelled = cinemaHasVerifiedSeatMap(cinema.slug)
    if (modelFilter === '3d' && !modelled) return false
    if (modelFilter === 'information' && modelled) return false
    if (!cinemaMatchesVerifiedFormat(cinema.slug, format)) return false
    const fields = [
      cinema.name,
      cinema.address,
      cinema.city,
      cinema.brand,
      venuePrimaryLabel(cinema),
      ...(cinemaPublishedFacts[cinema.slug]?.namedFormats ?? []),
    ]
    return (
      !term ||
      fields.some((field) =>
        field
          .normalize('NFKC')
          .toLocaleLowerCase()
          .replace(/[\s\p{P}\p{S}]+/gu, '')
          .includes(term),
      )
    )
  })
}

export function includesCinemaCategory(
  selected: CinemaDiscoveryCategory,
  candidate: Exclude<CinemaDiscoveryCategory, 'all'>,
): boolean {
  return selected === 'all' || selected === candidate
}
