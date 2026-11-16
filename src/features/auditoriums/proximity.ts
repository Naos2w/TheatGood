import type { DirectoryHall } from './directory'

export interface GeoPoint {
  latitude: number
  longitude: number
}

interface CinemaLocation extends GeoPoint {
  address: string
  /** Published venue coordinates or mapped site centroid, not a hall entrance. */
  sourceUrl: string
}

/** One position per real cinema; auditoriums in the same venue share its distance. */
export const cinemaLocations: Record<string, CinemaLocation> = {
  'vieshow-taipei-hsinyi': {
    latitude: 25.03533,
    longitude: 121.56725,
    address: '臺北市信義區松壽路20號（影城場址，非第 12 廳入口）',
    sourceUrl: 'https://www.openstreetmap.org/way/1339824907',
  },
  tfai: {
    latitude: 25.05625,
    longitude: 121.44715,
    address: '新北市新莊區文藝路2號',
    sourceUrl: 'https://www.openstreetmap.org/way/1019205802',
  },
  'spot-taipei': {
    latitude: 25.053279,
    longitude: 121.52216,
    address: '臺北市中山區中山北路二段18號',
    sourceUrl: 'https://www.taiwan.net.tw/m1.aspx?id=a12-00253&print=1&sno=0001016',
  },
  'spot-huashan': {
    latitude: 25.04518,
    longitude: 121.52921,
    address: '臺北市中正區八德路一段1號（中六館）',
    sourceUrl: 'https://www.openstreetmap.org/node/11309203706',
  },
  'kaohsiung-film-archive': {
    latitude: 22.622435,
    longitude: 120.28878,
    address: '高雄市鹽埕區河西路10號',
    sourceUrl: 'https://www.tad.gov.tw/m1.aspx?id=9284&sNo=0001121',
  },
  'neiwei-art-center': {
    latitude: 22.657216,
    longitude: 120.282303,
    address: '高雄市鼓山區馬卡道路329號',
    sourceUrl: 'https://filmkh.org/tc/scene_detail?sc_sn=448',
  },
}

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180

/** Great-circle distance, in kilometres; not a walking or driving distance. */
export function distanceKm(from: GeoPoint, to: GeoPoint): number {
  const latDifference = toRadians(to.latitude - from.latitude)
  const lngDifference = toRadians(to.longitude - from.longitude)
  const arc =
    Math.sin(latDifference / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) *
      Math.cos(toRadians(to.latitude)) *
      Math.sin(lngDifference / 2) ** 2

  return 2 * 6371.0088 * Math.asin(Math.min(1, Math.sqrt(arc)))
}

export function distanceToCinemaKm(hall: DirectoryHall, origin: GeoPoint): number | undefined {
  const cinema = cinemaLocations[hall.cinemaSlug]
  return cinema ? distanceKm(origin, cinema) : undefined
}

/** Stable ranking; venues with unknown positions remain visible at the end. */
export function sortHallsByDistance(
  halls: readonly DirectoryHall[],
  origin: GeoPoint,
): DirectoryHall[] {
  return halls
    .map((hall, index) => ({
      hall,
      index,
      distance: distanceToCinemaKm(hall, origin) ?? Number.POSITIVE_INFINITY,
    }))
    .sort((a, b) => a.distance - b.distance || a.index - b.index)
    .map(({ hall }) => hall)
}
