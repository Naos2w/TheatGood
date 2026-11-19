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

/** Recognisable mall identity assets, sourced from official sites or published brand partners.
 * Never substitute a cinema logo for the mall logo; keep provenance for each asset. */
export interface MallIdentityAsset {
  src: string
  /** Exact image provenance: a published HTTPS source or a user-upload: reference. */
  sourceUrl: string
  kind: 'logo' | 'wordmark'
}

const mallLogoAssets: Readonly<Record<string, MallIdentityAsset>> = {
  'vieshow-nangang-lalaport': {
    src: '/malls/lalaport-mark.png',
    sourceUrl: 'https://seeklogo.com/vector-logo/445083/lalaport',
    kind: 'logo',
  },
  'vieshow-linkou-mitsui': {
    src: '/malls/mitsui-outlet-mark.png',
    sourceUrl: 'https://www.cathaypacific.com/cx/zh_TW/our-partners/mitsui-outlet-park-taiwan.html',
    kind: 'logo',
  },
  'vieshow-tainan-tsmall': {
    src: '/malls/tsmall-mark.png',
    sourceUrl: 'https://www.hotel-tainan.com.tw/jp/spot/ins.php?index_id=69&index_m_id=11',
    kind: 'logo',
  },
  'vieshow-taipei-qsquare': {
    src: '/malls/qsquare-app.png',
    sourceUrl: 'https://apps.apple.com/tw/app/id1182868124',
    kind: 'logo',
  },
  'vieshow-xindian-yulon': {
    src: '/malls/yulon-square.png',
    sourceUrl: 'https://apps.apple.com/tw/app/id6449417323',
    kind: 'logo',
  },
  'vieshow-banqiao-megacity': {
    src: '/malls/megacity-square.png',
    sourceUrl: 'user-upload:2026-11-17-megacity',
    kind: 'logo',
  },
  'vieshow-zhonghe-global': {
    src: '/malls/globalmall-square.png',
    sourceUrl: 'https://apps.apple.com/tw/app/id1095134873',
    kind: 'logo',
  },
  'vieshow-taoyuan-tonlin': {
    src: '/malls/tonlin-square.png',
    sourceUrl: 'https://apps.apple.com/tw/app/id1462854530',
    kind: 'logo',
  },
  'vieshow-taoyuan-geleven': {
    src: '/malls/geleven-square.png',
    sourceUrl: 'https://groupg.org/wp-content/uploads/2024/09/--1024x835.png',
    kind: 'logo',
  },
  'vieshow-toufen-shangshun': {
    src: '/malls/shangshun-mark.svg',
    sourceUrl: 'https://www.ss-plaza.com.tw/wp-content/uploads/2024/05/logo_color.svg',
    kind: 'logo',
  },
  'vieshow-hsinchu-fe21': {
    src: '/malls/feds-symbol-square.png',
    sourceUrl: 'https://www.feds.com.tw/',
    kind: 'logo',
  },
  'vieshow-hsinchu-bigcity': {
    src: '/malls/bigcity.ico',
    sourceUrl: 'https://www.febigcity.com/',
    kind: 'logo',
  },
  'vieshow-taichung-topcity': {
    src: '/malls/topcity.png',
    sourceUrl: 'https://www.topcity.com.tw/',
    kind: 'logo',
  },
  'vieshow-taichung-ifg': {
    src: '/malls/ifg-square.png',
    sourceUrl: 'user-upload:2026-11-17-ifg',
    kind: 'logo',
  },
  'vieshow-tainan-fe21': {
    src: '/malls/feds-symbol-square.png',
    sourceUrl: 'https://www.feds.com.tw/',
    kind: 'logo',
  },
  'vieshow-tainan-focus': {
    src: '/malls/focus-logo.svg',
    sourceUrl: 'https://www.focusquare.com.tw/',
    kind: 'logo',
  },
  'vieshow-kaohsiung-fe21': {
    src: '/malls/feds-symbol-square.png',
    sourceUrl: 'https://www.feds.com.tw/',
    kind: 'logo',
  },
  'vieshow-hualien-paradiso': {
    src: '/malls/paradiso-square.png',
    sourceUrl: 'user-upload:2026-11-17-paradiso',
    kind: 'logo',
  },
  'vieshow-muvie-taipei-a13': {
    src: '/malls/feds-symbol-square.png',
    sourceUrl: 'https://www.feds.com.tw/',
    kind: 'logo',
  },
  'vieshow-muvie-taichung-tigercity': {
    src: '/malls/tigercity-mark.png',
    sourceUrl: 'https://www.tigercity.com.tw/',
    kind: 'logo',
  },
  'miranew-taimall': {
    src: '/malls/taimall-app-logo.png',
    sourceUrl: 'https://www.taimall.com.tw/',
    kind: 'logo',
  },
}

export function mallIdentityAsset(cinemaSlug: string): MallIdentityAsset | undefined {
  return mallLogoAssets[cinemaSlug]
}

// Only freestanding Vie Show venues currently listed in the official directory.
// Never replace a missing shopping-centre logo with a cinema logo by accident.
const freestandingVieShow = new Set(['vieshow-taipei-hsinyi', 'vieshow-taipei-ximen'])

const vieShowBrandAsset: MallIdentityAsset = {
  src: '/brands/vieshow-symbol.png',
  sourceUrl: 'https://www.mitsui-shopping-park.com.tw/images/sidebar_info_4.jpg',
  kind: 'logo',
}

export function cinemaIdentityAsset(
  cinema: Pick<ChainCinema, 'slug' | 'brand'>,
): MallIdentityAsset | undefined {
  const shoppingCentre = mallIdentityAsset(cinema.slug)
  if (shoppingCentre) return shoppingCentre
  if (cinema.brand === 'vieshow' && freestandingVieShow.has(cinema.slug)) {
    return vieShowBrandAsset
  }
  return undefined
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
