/**
 * Human-opened official film timetable pages. These are links, NOT licensed
 * machine-readable feeds. No showtime, hall allocation, availability, booking,
 * ticket price or seat inventory is fetched/persisted by TheatGood.
 *
 * The operator may change pages and schedules without notice. URLs were
 * checked against the operator's published website on 2026-11-16.
 */
import { chainCinemas } from './chain-directory'

export interface OfficialShowtimeLink {
  cinemaSlug: string
  url: string
  /** Brand-wide pages require the visitor to choose a location on the operator website. */
  scope: 'cinema' | 'brand'
  checkedAt: '2026-11-16'
}

const checkedAt = '2026-11-16' as const
const vieshowBase = 'https://www.vscinemas.com.tw/theater/'
const showtimeBase = 'https://www.showtimes.com.tw/cinemas/'

const vieshowCinemaIds: Readonly<Record<string, number>> = {
  'vieshow-taipei-hsinyi': 1,
  'vieshow-nangang-lalaport': 34,
  'vieshow-taipei-qsquare': 2,
  'vieshow-taipei-ximen': 31,
  'vieshow-xindian-yulon': 28,
  'vieshow-banqiao-megacity': 4,
  'vieshow-zhonghe-global': 25,
  'vieshow-linkou-mitsui': 5,
  'vieshow-taoyuan-tonlin': 20,
  'vieshow-taoyuan-geleven': 29,
  'vieshow-hsinchu-fe21': 7,
  'vieshow-hsinchu-bigcity': 9,
  'vieshow-toufen-shangshun': 10,
  'vieshow-taichung-topcity': 11,
  'vieshow-taichung-ifg': 26,
  'vieshow-tainan-fe21': 15,
  'vieshow-tainan-focus': 22,
  'vieshow-tainan-tsmall': 16,
  'vieshow-kaohsiung-fe21': 18,
  'vieshow-hualien-paradiso': 21,
}

const showtimeCinemaIds: Readonly<Record<string, number>> = {
  'showtime-kaohsiung-gangshan': 84,
  'showtime-kaohsiung-dreammall': 87,
  'showtime-tainan-rende': 60,
  'showtime-yunlin-beigang': 58,
  'showtime-taitung': 7,
  'showtime-hualien': 3,
  'showtime-keelung': 5,
  'showtime-chiayi': 9,
  'showtime-taichung-lipao': 59,
  'showtime-taichung-wenxin': 56,
  'showtime-taichung-station': 53,
  'showtime-tucheng': 55,
  'showtime-shulin': 54,
  'showtime-taipei-xinxin': 2,
  'showtime-taipei-dome': 91,
}

/** Maintain all direct links using the same slugs as the verified cinema directory. */
const entries: OfficialShowtimeLink[] = [
  ...Object.entries(vieshowCinemaIds).map(([cinemaSlug, id]) => ({
    cinemaSlug,
    url: `${vieshowBase}detail.aspx?id=${id}`,
    scope: 'cinema' as const,
    checkedAt,
  })),
  {
    cinemaSlug: 'vieshow-muvie-taipei-a13',
    url: `${vieshowBase}detail2.aspx?id=23`,
    scope: 'cinema',
    checkedAt,
  },
  {
    cinemaSlug: 'vieshow-muvie-taichung-tigercity',
    url: `${vieshowBase}detail2.aspx?id=12`,
    scope: 'cinema',
    checkedAt,
  },
  ...Object.entries(showtimeCinemaIds).map(([cinemaSlug, id]) => ({
    cinemaSlug,
    url: `${showtimeBase}${id}/`,
    scope: 'cinema' as const,
    checkedAt,
  })),
  {
    cinemaSlug: 'miramar-dazhi',
    url: 'https://www.miramarcinemas.tw/Timetable/Index',
    scope: 'cinema',
    checkedAt,
  },
  // Miranew presents a single timetable where users select the desired cinema.
  {
    cinemaSlug: 'miranew-taimall',
    url: 'https://www.miranewcinemas.com/Booking/Timetable',
    scope: 'brand',
    checkedAt,
  },
  {
    cinemaSlug: 'miranew-dazhi-royal',
    url: 'https://www.miranewcinemas.com/Booking/Timetable',
    scope: 'brand',
    checkedAt,
  },
]

export const officialShowtimeLinks: Readonly<Record<string, OfficialShowtimeLink>> =
  Object.fromEntries(entries.map((item) => [item.cinemaSlug, item]))

if (
  entries.length !== chainCinemas.filter((cinema) => cinema.checkedAt === '2026-11-16').length ||
  Object.keys(officialShowtimeLinks).length !== entries.length ||
  chainCinemas.some(
    (cinema) => cinema.checkedAt === '2026-11-16' && !officialShowtimeLinks[cinema.slug],
  )
) {
  throw new Error('Official cinema showtime links must cover the complete current chain directory')
}

export function officialShowtimeLink(cinemaSlug: string): OfficialShowtimeLink | undefined {
  return officialShowtimeLinks[cinemaSlug]
}
