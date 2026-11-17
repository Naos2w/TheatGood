/**
 * Operator-sourced cinema-level auditorium facts only. These are NOT floor plans.
 *
 * Showtime https://www.showtimes.com.tw/cinemas/{id}/ (2026-11-16)
 * Miramar https://www.miramarcinemas.tw/Home/groupticket2 (2026-11-16)
 * Miranew https://www.miranewcinemas.com/Special/Index?type=royal (2026-11-16)
 *
 * Important: some Showtime descriptions mention a number of 'digital halls'
 * *besides* named premium screens. Preserve that as a scoped observation,
 * never pretend it is a complete list or numbered hall inventory.
 */
import { chainCinemas } from './chain-directory'
import {
  publishedHallsForCinema,
  VIESHOW_HALL_SOURCE,
  VIESHOW_HALL_SOURCE_DATE,
} from './vieshow-halls'

export type HallCountScope = 'entire-cinema' | 'digital-halls' | 'royal-only'

export interface CinemaPublishedFacts {
  cinemaSlug: string
  sourceUrl: string
  checkedAt: string
  hallCount?: number
  hallCountScope?: HallCountScope
  /** Whole cinema seats except for royal-only entries, where it is royal seats. */
  publishedSeatCount?: number
  namedFormats?: string[]
}

export interface PublishedNamedHall {
  cinemaSlug: string
  label: string
  publishedSeatCount: number
  sourceUrl: string
  sourceDate: string
  dataLevel: 'published-count-only'
  /** Only populated when a separate operator source confirms actual screen dimensions. */
  screenWidthM?: number
  screenHeightM?: number
  screenShape?: 'curved' | 'flat'
  screenSourceUrl?: string
}

const checkedAt = '2026-11-16'
const showtime = (id: number): string => `https://www.showtimes.com.tw/cinemas/${id}/`
const royalUrl = 'https://www.miranewcinemas.com/Special/Index?type=royal'
export const MIRAMAR_HALL_SOURCE = 'https://www.miramarcinemas.tw/Home/groupticket2'
export const MIRAMAR_IMAX_SCREEN_SOURCE = 'https://www.miramarcinemas.tw/Home/imaxcinema'

/** Only those halls whose labels and capacities appear explicitly in the operator's group-booking page. */
export const miramarPublishedHalls: readonly PublishedNamedHall[] = [
  ['1', 277],
  ['2', 224],
  ['3', 226],
  ['5', 330],
  ['7', 239],
  ['8', 247],
  ['9', 330],
  ['10', 330],
  ['Dolby Cinema', 303],
  ['IMAX', 404],
].map(([label, publishedSeatCount]) => ({
  cinemaSlug: 'miramar-dazhi',
  label: String(label),
  publishedSeatCount: Number(publishedSeatCount),
  sourceUrl: MIRAMAR_HALL_SOURCE,
  sourceDate: checkedAt,
  dataLevel: 'published-count-only' as const,
  ...(String(label) === 'IMAX'
    ? {
        screenWidthM: 28.4,
        screenHeightM: 20.54,
        screenShape: 'curved' as const,
        screenSourceUrl: MIRAMAR_IMAX_SCREEN_SOURCE,
      }
    : {}),
}))

const observations: readonly CinemaPublishedFacts[] = [
  {
    cinemaSlug: 'showtime-kaohsiung-gangshan',
    sourceUrl: showtime(84),
    checkedAt,
    hallCount: 12,
    hallCountScope: 'digital-halls',
    publishedSeatCount: 1428,
    namedFormats: ['SCREENX'],
  },
  {
    cinemaSlug: 'showtime-kaohsiung-dreammall',
    sourceUrl: showtime(87),
    checkedAt,
    hallCount: 13,
    hallCountScope: 'entire-cinema',
    publishedSeatCount: 1852,
    namedFormats: ['SCREENX', '寬巨幕'],
  },
  { cinemaSlug: 'showtime-tainan-rende', sourceUrl: showtime(60), checkedAt },
  { cinemaSlug: 'showtime-yunlin-beigang', sourceUrl: showtime(58), checkedAt },
  {
    cinemaSlug: 'showtime-taitung',
    sourceUrl: showtime(7),
    checkedAt,
    hallCount: 8,
    hallCountScope: 'entire-cinema',
  },
  { cinemaSlug: 'showtime-hualien', sourceUrl: showtime(3), checkedAt },
  {
    cinemaSlug: 'showtime-keelung',
    sourceUrl: showtime(5),
    checkedAt,
    hallCount: 8,
    hallCountScope: 'entire-cinema',
    publishedSeatCount: 1033,
  },
  {
    cinemaSlug: 'showtime-chiayi',
    sourceUrl: showtime(9),
    checkedAt,
    hallCount: 10,
    hallCountScope: 'digital-halls',
    publishedSeatCount: 1387,
    namedFormats: ['SCREENX'],
  },
  // The official LiHPAO Outlet Mall tenant listing publishes 10 halls / 811 seats,
  // explicitly scoped to its Showtime Cinema at 3F D-wing.
  {
    cinemaSlug: 'showtime-taichung-lipao',
    sourceUrl: 'https://www.lihpaooutlet.com.tw/Brand/Details/268',
    checkedAt,
    hallCount: 10,
    hallCountScope: 'entire-cinema',
    publishedSeatCount: 811,
  },
  {
    cinemaSlug: 'showtime-taichung-wenxin',
    sourceUrl: showtime(56),
    checkedAt,
    hallCount: 12,
    hallCountScope: 'digital-halls',
    namedFormats: ['SCREENX', 'ULTRA 4DX', 'LG Miraclass', '丹普廳'],
  },
  {
    cinemaSlug: 'showtime-taichung-station',
    sourceUrl: showtime(53),
    checkedAt,
    hallCount: 16,
    hallCountScope: 'digital-halls',
    publishedSeatCount: 2669,
    namedFormats: ['SCREENX', 'Dolby Vision + Atmos'],
  },
  {
    cinemaSlug: 'showtime-tucheng',
    sourceUrl: showtime(55),
    checkedAt,
    hallCount: 11,
    hallCountScope: 'entire-cinema',
  },
  {
    cinemaSlug: 'showtime-shulin',
    sourceUrl: showtime(54),
    checkedAt,
    hallCount: 11,
    hallCountScope: 'digital-halls',
    publishedSeatCount: 1581,
    namedFormats: ['SCREENX'],
  },
  {
    cinemaSlug: 'showtime-taipei-xinxin',
    sourceUrl: showtime(2),
    checkedAt,
    hallCount: 14,
    hallCountScope: 'digital-halls',
    publishedSeatCount: 1528,
    namedFormats: ['SCREENX'],
  },
  {
    cinemaSlug: 'showtime-taipei-dome',
    sourceUrl: showtime(91),
    checkedAt,
    hallCount: 14,
    hallCountScope: 'entire-cinema',
    namedFormats: ['ULTRA 4DX', 'SCREENX', 'Dolby Vision + Atmos', 'REMMI'],
  },
  {
    cinemaSlug: 'miramar-dazhi',
    sourceUrl: MIRAMAR_HALL_SOURCE,
    checkedAt,
    namedFormats: ['Dolby Cinema', 'IMAX'],
  },
  {
    cinemaSlug: 'miranew-taimall',
    sourceUrl: royalUrl,
    checkedAt,
    hallCount: 2,
    hallCountScope: 'royal-only',
  },
  {
    cinemaSlug: 'miranew-dazhi-royal',
    sourceUrl: royalUrl,
    checkedAt,
    hallCount: 8,
    hallCountScope: 'royal-only',
    publishedSeatCount: 202,
  },
]

const registered = new Set(chainCinemas.map((cinema) => cinema.slug))
if (observations.some((item) => !registered.has(item.cinemaSlug))) {
  throw new Error('A sourced venue fact does not map to the existing cinema directory')
}

export const cinemaPublishedFacts: Readonly<Record<string, CinemaPublishedFacts>> =
  Object.fromEntries(observations.map((item) => [item.cinemaSlug, item]))

export function publishedNamedHallsForCinema(cinemaSlug: string): PublishedNamedHall[] {
  if (cinemaSlug === 'miramar-dazhi') return [...miramarPublishedHalls]
  return publishedHallsForCinema(cinemaSlug).map((hall) => ({
    cinemaSlug,
    label: String(hall.hallNumber),
    publishedSeatCount: hall.publishedSeatCount,
    sourceUrl: VIESHOW_HALL_SOURCE,
    sourceDate: VIESHOW_HALL_SOURCE_DATE,
    dataLevel: 'published-count-only',
  }))
}

/** This is the sum of ONLY halls with individual seat counts, not necessarily total venue capacity. */
export function publishedNamedHallSeatSum(cinemaSlug: string): number {
  return publishedNamedHallsForCinema(cinemaSlug).reduce(
    (sum, hall) => sum + hall.publishedSeatCount,
    0,
  )
}
