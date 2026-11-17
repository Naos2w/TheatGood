import type { ChainCinema } from './chain-directory'

/** The filter represents a VERIFIED format at the cinema location, not a hall-specific seat map. */
export type AuditoriumFormatFilter = 'all' | 'imax' | 'giant' | '4dx'

export type VenueFormat = Exclude<AuditoriumFormatFilter, 'all'>

/**
 * Only explicitly published auditorium features. The operator lists these by
 * branch, not necessarily by screen number. Never assign a special format to
 * an arbitrary numbered booking layout.
 *
 * Sources: https://www.vscinemas.com.tw/brand/index.aspx?A=2 (IMAX),
 * https://www.vscinemas.com.tw/about/ (4DX), and
 * https://www.vscinemas.com.tw/theater/detail2.aspx?id=12 (2026 TIGER CITY TITAN).
 * The specific newer venue page overrides older general format lists.
 * The format "3D" is per movie/session, not a permanent auditorium category;
 * no screening-specific 3D availability is claimed here.
 */
const verifiedVenueFormats: Readonly<Record<string, readonly VenueFormat[]>> = {
  'vieshow-hsinchu-bigcity': ['imax'],
  'vieshow-taichung-topcity': ['imax'],
  'vieshow-muvie-taichung-tigercity': ['giant'],
  'vieshow-tainan-tsmall': ['imax'],
  'vieshow-banqiao-megacity': ['imax'],
  'vieshow-xindian-yulon': ['imax'],
  'vieshow-kaohsiung-fe21': ['imax', '4dx'],
  'vieshow-hualien-paradiso': ['imax'],
  'vieshow-taipei-hsinyi': ['4dx'],
  'vieshow-linkou-mitsui': ['4dx'],
  'vieshow-tainan-fe21': ['4dx'],
  'vieshow-muvie-taipei-a13': ['giant'],
}

export function verifiedFormatsForCinema(slug: string): readonly VenueFormat[] {
  return verifiedVenueFormats[slug] ?? []
}

export function cinemaHasFormat(slug: string, format: AuditoriumFormatFilter): boolean {
  return format === 'all' || verifiedFormatsForCinema(slug).includes(format)
}

/**
 * Shopping-centre names verified from the official location pages. A missing
 * entry means we show the cinema name rather than invent a shopping centre.
 * https://www.vscinemas.com.tw/theater/
 */
const venueLandmarks: Readonly<Record<string, string>> = {
  'vieshow-nangang-lalaport': 'LaLaport 南港',
  'vieshow-taipei-qsquare': '京站時尚廣場',
  'vieshow-xindian-yulon': '裕隆城',
  'vieshow-banqiao-megacity': 'Mega City 板橋大遠百',
  'vieshow-zhonghe-global': 'Global Mall 中和環球',
  'vieshow-linkou-mitsui': 'MITSUI OUTLET PARK 林口',
  'vieshow-taoyuan-tonlin': '桃園統領',
  'vieshow-taoyuan-geleven': '桃知道',
  'vieshow-hsinchu-fe21': '新竹大遠百',
  'vieshow-hsinchu-bigcity': 'Big City 遠東巨城',
  'vieshow-toufen-shangshun': '尚順購物中心',
  'vieshow-taichung-topcity': 'Top City 台中大遠百',
  'vieshow-taichung-ifg': 'iFG 遠雄廣場',
  'vieshow-tainan-fe21': '台南大遠百',
  'vieshow-tainan-focus': 'FOCUS 時尚流行館',
  'vieshow-tainan-tsmall': '南紡購物中心',
  'vieshow-kaohsiung-fe21': '高雄大遠百',
  'vieshow-hualien-paradiso': '新天堂樂園',
  'vieshow-muvie-taipei-a13': '遠百信義 A13',
  'vieshow-muvie-taichung-tigercity': 'TIGER CITY 老虎城',
}

export function venuePrimaryLabel(cinema: Pick<ChainCinema, 'slug' | 'name'>): string {
  const landmark = venueLandmarks[cinema.slug]
  if (landmark) return landmark
  // A freestanding cinema has no shopping-centre name; avoid repeating the
  // operator brand both in the title and the coloured brand chip.
  if (cinema.slug.startsWith('vieshow-')) return cinema.name.replace(/威秀影城$/, '')
  return cinema.name
}

export function venueBrandLabel(cinema: Pick<ChainCinema, 'slug' | 'brand'>): string {
  if (cinema.slug.startsWith('vieshow-muvie-')) return 'MUVIE'
  switch (cinema.brand) {
    case 'vieshow':
      return '威秀影城'
    case 'showtime':
      return '秀泰影城'
    case 'miramar':
      return '美麗華影城'
    case 'miranew':
      return '美麗新影城'
  }
}

export function venueBrandVariant(cinema: Pick<ChainCinema, 'slug' | 'brand'>): string {
  return cinema.slug.startsWith('vieshow-muvie-') ? 'muvie' : cinema.brand
}

export function cinemaHasPublicSeatMap(slug: string, count: number | undefined): boolean {
  return (count ?? 0) > 0
}
