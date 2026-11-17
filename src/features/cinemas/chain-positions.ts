import type { GeoPoint } from '../auditoriums/proximity'
import { distanceKm } from '../auditoriums/proximity'
import type { ChainCinema } from './chain-directory'

export interface VerifiedChainPosition extends GeoPoint {
  /** Source of a mapped cinema, building or mall position; not an auditorium entrance. */
  sourceUrl: string
  /** Whether the mapped object is the cinema itself or its containing shopping centre. */
  precision: 'cinema' | 'site'
}

/**
 * Manually reconciled cinema and containing-building locations: most are OSM
 * nodes/ways (© OpenStreetMap contributors, ODbL), with one independently
 * published Tainan Park Store site coordinate from a venue guide. Every point
 * is linked to its exact source rather than derived from a generic city centre.
 * Sources: https://www.openstreetmap.org/copyright
 * No geocoding API is invoked by the application.
 */
export const verifiedChainPositions: Record<string, VerifiedChainPosition> = {
  'vieshow-taipei-hsinyi': {
    latitude: 25.03533,
    longitude: 121.56725,
    sourceUrl: 'https://www.openstreetmap.org/way/1339824907',
    precision: 'site',
  },
  // The operator replaced the former CMK/JueSe cinema at the same Hanzhong St 52 building.
  'vieshow-taipei-ximen': {
    latitude: 25.04378,
    longitude: 121.50717,
    sourceUrl: 'https://www.openstreetmap.org/node/2406854920',
    precision: 'site',
  },
  'vieshow-xindian-yulon': {
    latitude: 24.97807,
    longitude: 121.54668,
    sourceUrl: 'https://www.openstreetmap.org/way/315997996',
    precision: 'site',
  },
  'vieshow-linkou-mitsui': {
    latitude: 25.07064,
    longitude: 121.36511,
    sourceUrl: 'https://www.openstreetmap.org/way/364304008',
    precision: 'site',
  },
  'vieshow-hsinchu-bigcity': {
    latitude: 24.81006,
    longitude: 120.97507,
    sourceUrl: 'https://www.openstreetmap.org/way/1010524516',
    precision: 'site',
  },
  'vieshow-taichung-topcity': {
    latitude: 24.16417,
    longitude: 120.64448,
    sourceUrl: 'https://www.openstreetmap.org/way/224955652',
    precision: 'site',
  },
  // Far Eastern Park Store site coordinates (5F cinema); approximate site centre.
  // The guide gives the coordinate pair as (22.995131, 120.205680).
  'vieshow-tainan-fe21': {
    latitude: 22.995131,
    longitude: 120.20568,
    sourceUrl: 'https://www.vrwalker.net/tw/print.php?serno=222&tbname=scenerys',
    precision: 'site',
  },
  'vieshow-tainan-focus': {
    latitude: 22.99554,
    longitude: 120.2103,
    sourceUrl: 'https://www.openstreetmap.org/way/203984821',
    precision: 'site',
  },
  'vieshow-muvie-taichung-tigercity': {
    latitude: 24.16436,
    longitude: 120.63785,
    sourceUrl: 'https://www.openstreetmap.org/way/150999799',
    precision: 'site',
  },
  'vieshow-muvie-taipei-a13': {
    latitude: 25.03686,
    longitude: 121.5679,
    sourceUrl: 'https://www.openstreetmap.org/way/663679150',
    precision: 'site',
  },
  'vieshow-hualien-paradiso': {
    latitude: 23.93909,
    longitude: 121.59512,
    sourceUrl: 'https://www.openstreetmap.org/way/652201973',
    precision: 'site',
  },
  'vieshow-kaohsiung-fe21': {
    latitude: 22.61275,
    longitude: 120.30445,
    sourceUrl: 'https://www.openstreetmap.org/node/2676526318',
    precision: 'cinema',
  },
  'vieshow-tainan-tsmall': {
    latitude: 22.99067,
    longitude: 120.23303,
    sourceUrl: 'https://www.openstreetmap.org/way/1389576168',
    precision: 'site',
  },
  'vieshow-nangang-lalaport': {
    latitude: 25.05982,
    longitude: 121.61765,
    sourceUrl: 'https://www.openstreetmap.org/node/12997346754',
    precision: 'cinema',
  },
  'vieshow-taipei-qsquare': {
    latitude: 25.04908,
    longitude: 121.51843,
    sourceUrl: 'https://www.openstreetmap.org/node/3637249708',
    precision: 'cinema',
  },
  'vieshow-banqiao-megacity': {
    latitude: 25.01403,
    longitude: 121.46714,
    sourceUrl: 'https://www.openstreetmap.org/node/2722708583',
    precision: 'cinema',
  },
  'vieshow-zhonghe-global': {
    latitude: 25.00672,
    longitude: 121.47467,
    sourceUrl: 'https://www.openstreetmap.org/node/11127163086',
    precision: 'cinema',
  },
  'vieshow-taoyuan-tonlin': {
    latitude: 24.99103,
    longitude: 121.31245,
    sourceUrl: 'https://www.openstreetmap.org/node/11958493287',
    precision: 'cinema',
  },
  'vieshow-taoyuan-geleven': {
    latitude: 25.01837,
    longitude: 121.29977,
    sourceUrl: 'https://www.openstreetmap.org/way/1396500252',
    precision: 'cinema',
  },
  'vieshow-hsinchu-fe21': {
    latitude: 24.80208,
    longitude: 120.9651,
    sourceUrl: 'https://www.openstreetmap.org/node/1101582091',
    precision: 'cinema',
  },
  'vieshow-toufen-shangshun': {
    latitude: 24.68916,
    longitude: 120.90435,
    sourceUrl: 'https://www.openstreetmap.org/node/4111207337',
    precision: 'cinema',
  },
  'vieshow-taichung-ifg': {
    latitude: 24.136,
    longitude: 120.68766,
    sourceUrl: 'https://www.openstreetmap.org/way/1006320442',
    precision: 'cinema',
  },
  'showtime-kaohsiung-dreammall': {
    latitude: 22.5951,
    longitude: 120.30686,
    sourceUrl: 'https://www.openstreetmap.org/way/205030322',
    precision: 'site',
  },
  'showtime-taipei-dome': {
    latitude: 25.04316,
    longitude: 121.56027,
    sourceUrl: 'https://www.openstreetmap.org/way/229060949',
    precision: 'site',
  },
  // This is the D-wing shopping centre housing the cinema on floor 3, not its entrance.
  'showtime-taichung-lipao': {
    latitude: 24.32652,
    longitude: 120.70196,
    sourceUrl: 'https://www.openstreetmap.org/way/795510490',
    precision: 'site',
  },
  'showtime-tainan-rende': {
    latitude: 22.94676,
    longitude: 120.22026,
    sourceUrl: 'https://www.openstreetmap.org/node/7259879557',
    precision: 'cinema',
  },
  'showtime-yunlin-beigang': {
    latitude: 23.57008,
    longitude: 120.29928,
    sourceUrl: 'https://www.openstreetmap.org/node/7197210913',
    precision: 'cinema',
  },
  'showtime-keelung': {
    latitude: 25.13093,
    longitude: 121.74498,
    sourceUrl: 'https://www.openstreetmap.org/node/5170039607',
    precision: 'cinema',
  },
  'showtime-kaohsiung-gangshan': {
    latitude: 22.77971,
    longitude: 120.30048,
    sourceUrl: 'https://www.openstreetmap.org/node/9923973218',
    precision: 'cinema',
  },
  'showtime-taichung-wenxin': {
    latitude: 24.12992,
    longitude: 120.64602,
    sourceUrl: 'https://www.openstreetmap.org/node/11862318075',
    precision: 'cinema',
  },
  'showtime-taichung-station': {
    latitude: 24.14043,
    longitude: 120.68984,
    sourceUrl: 'https://www.openstreetmap.org/node/4672469027',
    precision: 'cinema',
  },
  'showtime-tucheng': {
    latitude: 24.97908,
    longitude: 121.44494,
    sourceUrl: 'https://www.openstreetmap.org/node/9108436636',
    precision: 'cinema',
  },
  'showtime-shulin': {
    latitude: 24.99552,
    longitude: 121.42851,
    sourceUrl: 'https://www.openstreetmap.org/node/5569039581',
    precision: 'cinema',
  },
  'showtime-taipei-xinxin': {
    latitude: 25.05415,
    longitude: 121.52599,
    sourceUrl: 'https://www.openstreetmap.org/node/2533594393',
    precision: 'cinema',
  },
  'showtime-chiayi': {
    latitude: 23.48547,
    longitude: 120.44776,
    sourceUrl: 'https://www.openstreetmap.org/way/484594478',
    precision: 'cinema',
  },
  'showtime-hualien': {
    latitude: 23.99098,
    longitude: 121.60526,
    sourceUrl: 'https://www.openstreetmap.org/node/3223341161',
    precision: 'cinema',
  },
  'showtime-taitung': {
    latitude: 22.75193,
    longitude: 121.1482,
    sourceUrl: 'https://www.openstreetmap.org/way/427763538',
    precision: 'site',
  },
  'miramar-dazhi': {
    latitude: 25.08328,
    longitude: 121.55746,
    sourceUrl: 'https://www.openstreetmap.org/way/155816458',
    precision: 'site',
  },
  'miranew-taimall': {
    latitude: 25.05335,
    longitude: 121.28828,
    sourceUrl: 'https://www.openstreetmap.org/node/12079606904',
    precision: 'cinema',
  },
  'miranew-dazhi-royal': {
    latitude: 25.08483,
    longitude: 121.55402,
    sourceUrl: 'https://www.openstreetmap.org/node/6505166519',
    precision: 'cinema',
  },
}

/** Venue point distance in km, never walking/driving distance. */
export function chainDistanceKm(cinema: ChainCinema, origin: GeoPoint): number | undefined {
  const location = verifiedChainPositions[cinema.slug]
  return location ? distanceKm(origin, location) : undefined
}

/** Deterministic rank with unknown coordinates last, while keeping them searchable. */
export function sortChainsByDistance(
  venues: readonly ChainCinema[],
  origin: GeoPoint,
): ChainCinema[] {
  return venues
    .map((cinema, index) => ({
      cinema,
      index,
      distance: chainDistanceKm(cinema, origin) ?? Number.POSITIVE_INFINITY,
    }))
    .sort((left, right) => left.distance - right.distance || left.index - right.index)
    .map(({ cinema }) => cinema)
}
