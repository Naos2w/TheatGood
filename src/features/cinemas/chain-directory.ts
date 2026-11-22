/**
 * Major Taiwan cinema chains — cinema/venue directory, NOT auditorium geometry.
 * Names and site addresses are sourced from the operator's published location pages.
 * A venue being listed does NOT establish a verified hall/seat map or reusable
 * screening API. No seat counts, showtimes, coordinates or current opening hours
 * are invented here.
 */
import addedChainBranchResearch from './data/additional-chain-branches-2026-11-18.json'

export type ChainBrand =
  | 'vieshow'
  | 'showtime'
  | 'miramar'
  | 'miranew'
  | 'ambassador'
  | 'in89'
  | 'broadway'
  | 'centuryasia'
  | 'skcinemas'

export interface ChainCinema {
  slug: string
  name: string
  brand: ChainBrand
  city: string
  address: string
  sourceUrl: string
  checkedAt: '2026-11-16' | '2026-11-18'
  /** Archived operator listing, not a confirmation the venue is open now. */
  listingEvidence?: 'official_direct' | 'official_rendered_branch_page' | 'operator_owned_line'
  operatingNowVerified?: false
}

const checkedAt = '2026-11-16' as const
const vieshowSource = 'https://www.vscinemas.com.tw/theater/'
const showtimeSource = 'https://www.showtimes.com.tw/cinemas/'

type BranchInfo = readonly [slug: string, name: string, city: string, address: string]

function fromOfficialDirectory(
  brand: ChainBrand,
  sourceUrl: string,
  locations: readonly BranchInfo[],
): ChainCinema[] {
  return locations.map(([slug, name, city, address]) => ({
    slug: brand + '-' + slug,
    brand,
    name,
    city,
    address,
    sourceUrl,
    checkedAt,
  }))
}

const vieshow = fromOfficialDirectory('vieshow', vieshowSource, [
  ['taipei-hsinyi', '台北信義威秀影城', '臺北市', '臺北市信義區松壽路20號'],
  ['nangang-lalaport', '台北南港LaLaport威秀影城', '臺北市', '臺北市南港區經貿二路131號5樓'],
  ['taipei-qsquare', '台北京站威秀影城', '臺北市', '臺北市大同區市民大道一段209號5樓'],
  ['taipei-ximen', '台北西門威秀影城', '臺北市', '臺北市萬華區漢中街52號8–11樓'],
  ['xindian-yulon', '新店裕隆城威秀影城', '新北市', '新北市新店區中興路三段70號7樓'],
  ['banqiao-megacity', '板橋大遠百威秀影城', '新北市', '新北市板橋區新站路28號10樓'],
  ['zhonghe-global', '中和環球威秀影城', '新北市', '新北市中和區中山路三段122號4樓'],
  ['linkou-mitsui', '林口MITSUI OUTLET PARK威秀影城', '新北市', '新北市林口區文化三路一段356號3樓'],
  ['taoyuan-tonlin', '桃園統領威秀影城', '桃園市', '桃園市桃園區中正路61號9樓'],
  ['taoyuan-geleven', '桃園桃知道威秀影城', '桃園市', '桃園市桃園區南平路301號4樓'],
  ['hsinchu-fe21', '新竹大遠百威秀影城', '新竹市', '新竹市西大路323號8樓'],
  ['hsinchu-bigcity', '新竹巨城威秀影城', '新竹市', '新竹市民權路176號4樓之3'],
  ['toufen-shangshun', '頭份尚順威秀影城', '苗栗縣', '苗栗縣頭份市育樂街8號7樓'],
  ['taichung-topcity', '台中大遠百威秀影城', '臺中市', '臺中市西屯區臺灣大道三段251號13樓'],
  ['taichung-ifg', '台中iFG遠雄廣場威秀影城', '臺中市', '臺中市東區復興路四段186號4樓'],
  ['tainan-fe21', '台南大遠百威秀影城', '臺南市', '臺南市中西區公園路60號5樓'],
  ['tainan-focus', '台南FOCUS威秀影城', '臺南市', '臺南市中西區中山路166號11樓'],
  [
    'tainan-tsmall',
    '台南南紡威秀影城',
    '臺南市',
    '臺南市東區中華東路一段366號5樓（A1）／358號B1樓（A2）',
  ],
  ['kaohsiung-fe21', '高雄大遠百威秀影城', '高雄市', '高雄市苓雅區三多四路21號13樓'],
  ['hualien-paradiso', '花蓮新天堂樂園威秀影城', '花蓮縣', '花蓮縣吉安鄉南濱路一段503號3樓'],
])
vieshow.push(
  ...fromOfficialDirectory('vieshow', 'https://www.vscinemas.com.tw/brand/theaterList.aspx?A=12', [
    ['muvie-taipei-a13', 'MUVIE CINEMAS 台北松仁', '臺北市', '臺北市信義區松仁路58號10樓'],
  ]),
  ...fromOfficialDirectory('vieshow', 'https://www.vscinemas.com.tw/brand/theaterList.aspx?A=3', [
    [
      'muvie-taichung-tigercity',
      'MUVIE CINEMAS 台中TIGER CITY',
      '臺中市',
      '臺中市西屯區河南路三段120-1號4樓',
    ],
  ]),
)

const showtime = fromOfficialDirectory('showtime', showtimeSource, [
  ['kaohsiung-gangshan', '高雄岡山秀泰影城', '高雄市', '高雄市岡山區捷安路1巷2號4樓'],
  ['kaohsiung-dreammall', '高雄夢時代秀泰影城', '高雄市', '高雄市前鎮區中華五路789號8樓'],
  ['tainan-rende', '台南仁德秀泰影城', '臺南市', '臺南市仁德區大同路三段759號2樓'],
  ['yunlin-beigang', '北港秀泰影城', '雲林縣', '雲林縣北港鎮華南路101號2樓'],
  ['taitung', '台東秀泰影城', '臺東縣', '臺東縣臺東市新生路93號'],
  ['hualien', '花蓮秀泰影城', '花蓮縣', '花蓮縣花蓮市國聯五路69號'],
  ['keelung', '基隆秀泰影城', '基隆市', '基隆市信一路177號'],
  ['chiayi', '嘉義秀泰影城', '嘉義市', '嘉義市西區文化路299號'],
  ['taichung-lipao', '台中麗寶秀泰影城', '臺中市', '臺中市后里區月眉東路二段181號3樓'],
  ['taichung-wenxin', '台中文心秀泰影城', '臺中市', '臺中市南屯區文心南路289號7–8樓'],
  ['taichung-station', '台中站前秀泰影城', '臺中市', '臺中市東區南京路76號'],
  ['tucheng', '土城秀泰影城', '新北市', '新北市土城區學府路二段210號'],
  ['shulin', '樹林秀泰影城', '新北市', '新北市樹林區樹新路40-6號'],
  ['taipei-xinxin', '台北欣欣秀泰影城', '臺北市', '臺北市中山區林森北路247號'],
  ['taipei-dome', '大巨蛋秀泰影城', '臺北市', '臺北市信義區光復南路105號2樓'],
])

const miramar = fromOfficialDirectory('miramar', 'https://www.miramarcinemas.tw/Home/Index', [
  ['dazhi', '美麗華大直影城', '臺北市', '臺北市中山區敬業三路22號6樓'],
])

// Miranew Hong-Hui ceased operations on 2025-12-22; do not include it as active.
// Tai-Mall's Royal Cinema shares the same physical location as the main cinema.
const miranew = fromOfficialDirectory('miranew', 'https://www.miranewcinemas.com/', [
  ['taimall', '美麗新台茂影城（含皇家影城）', '桃園市', '桃園市蘆竹區南崁路一段112號7樓'],
  ['dazhi-royal', '美麗新大直皇家影城', '臺北市', '臺北市中山區北安路780號B2'],
])

const addedBrandSet: ReadonlySet<ChainBrand> = new Set([
  'ambassador',
  'in89',
  'broadway',
  'centuryasia',
  'skcinemas',
])
const additionalChains: ChainCinema[] = addedChainBranchResearch.records.map((record) => {
  if (
    !addedBrandSet.has(record.brand as ChainBrand) ||
    record.operatingNowVerified !== false ||
    record.observedSeatGridVerified !== false ||
    !record.slug.startsWith(record.brand + '-') ||
    record.checkedAt !== '2026-11-18'
  ) {
    throw new Error('Invalid historical operator branch source; do not publish as a live cinema')
  }
  return {
    brand: record.brand as ChainBrand,
    slug: record.slug,
    name: record.name,
    city: record.city,
    address: record.address,
    sourceUrl: record.sourceUrl,
    checkedAt: '2026-11-18',
    listingEvidence: record.listingEvidence as ChainCinema['listingEvidence'],
    operatingNowVerified: false,
  }
})

export const chainCinemas: readonly ChainCinema[] = [
  ...vieshow,
  ...showtime,
  ...miramar,
  ...miranew,
  ...additionalChains,
]

const normalise = (value: string): string =>
  value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, '')

export function searchChainCinemas(
  query: string,
  brand: ChainBrand | 'all' = 'all',
  city = 'all',
): ChainCinema[] {
  const term = normalise(query)
  return chainCinemas.filter(
    (cinema) =>
      (brand === 'all' || cinema.brand === brand) &&
      (city === 'all' || cinema.city === city) &&
      (!term ||
        [cinema.name, cinema.city, cinema.address, cinema.brand].some((field) =>
          normalise(field).includes(term),
        )),
  )
}
