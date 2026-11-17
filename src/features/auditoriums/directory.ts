/**
 * Curated auditorium directory from operator-owned public information.
 * This is a directory of verified facts, NOT a list of 3D-ready models.
 * Every unmeasured field remains absent rather than fabricated.
 */
export type SeatCountBasis = 'excludes-wheelchair' | 'includes-wheelchair' | 'unspecified'
export interface DirectoryHall {
  slug: string
  cinemaSlug: string
  cinemaName: string
  cinemaNameEn?: string
  brand: string
  city: string
  hallName: string
  hallNameEn?: string
  aliases: string[]
  cinemaAliases: string[]
  seatCount: number
  wheelchairSeats?: number
  seatCountBasis: SeatCountBasis
  screenWidthM?: number
  screenHeightM?: number
  format: string
  /** Present only when validated exact seat labels/geometry exist as a model. */
  modelId?: string
  sourceUrls: string[]
  checkedAt: string
}
export const cinemaDirectory: DirectoryHall[] = [
  {
    slug: 'vieshow-hsinyi-12',
    cinemaSlug: 'vieshow-taipei-hsinyi',
    cinemaName: '台北信義威秀影城',
    cinemaNameEn: 'Vie Show Cinemas Taipei Hsin Yi',
    brand: '威秀',
    city: '臺北市',
    hallName: '12 廳',
    hallNameEn: 'Screen 12',
    aliases: ['第12廳', '12廳', 'Screen 12', '金馬經典影展12廳'],
    cinemaAliases: ['信義威秀', '台北信義威秀', 'Vie Show Taipei Hsin Yi'],
    seatCount: 244,
    wheelchairSeats: 2,
    seatCountBasis: 'unspecified',
    format: '一般數位影廳（2026 影展座位圖；3D 尺寸估算）',
    modelId: 'vieshow-hsinyi-12',
    sourceUrls: [
      'https://tghff.tixcraft.com/activity/detail/26_ghcffp',
      'https://www.vscinemas.com.tw/upload/biz/biz_20260528001.pdf',
    ],
    checkedAt: '2026-11-16',
  },
  {
    slug: 'tfai-small',
    cinemaSlug: 'tfai',
    cinemaName: '國家電影及視聽文化中心',
    cinemaNameEn: 'Taiwan Film and Audiovisual Institute',
    brand: 'TFAI',
    city: '新北市',
    hallName: '小影格',
    hallNameEn: 'Small Cinema',
    aliases: ['小廳', '小影格', 'Small Cinema'],
    cinemaAliases: ['TFAI', '國影中心', '國家電影及視聽文化中心'],
    seatCount: 52,
    wheelchairSeats: 2,
    seatCountBasis: 'excludes-wheelchair',
    screenWidthM: 8.88,
    screenHeightM: 4.8,
    format: '4K RGB Laser / Dolby Atmos',
    modelId: 'tfai-small',
    sourceUrls: [
      'https://www.tfai.org.tw/rsrc/tfai_document/國家電影及視聽文化中心設備資料手冊.pdf',
      'https://www.tfai.org.tw/zh/page/camp.html',
    ],
    checkedAt: '2026-11-15',
  },
  {
    slug: 'tfai-big',
    cinemaSlug: 'tfai',
    cinemaName: '國家電影及視聽文化中心',
    cinemaNameEn: 'Taiwan Film and Audiovisual Institute',
    brand: 'TFAI',
    city: '新北市',
    hallName: '大影格',
    aliases: ['大廳', '大影格', 'Grand Cinema'],
    cinemaAliases: ['TFAI', '國影中心', '國家電影及視聽文化中心'],
    seatCount: 201,
    wheelchairSeats: 4,
    seatCountBasis: 'excludes-wheelchair',
    screenWidthM: 13.25,
    screenHeightM: 7.17,
    format: '4K RGB Laser / Dolby Atmos',
    sourceUrls: [
      'https://www.tfai.org.tw/rsrc/tfai_document/國家電影及視聽文化中心設備資料手冊.pdf',
      'https://www.tfai.org.tw/zh/page/camp.html',
    ],
    checkedAt: '2026-11-15',
  },
  {
    slug: 'spot-taipei',
    cinemaSlug: 'spot-taipei',
    cinemaName: '光點台北電影館',
    cinemaNameEn: 'SPOT Taipei',
    brand: 'SPOT',
    city: '臺北市',
    hallName: '光點電影院',
    hallNameEn: 'SPOT Cinema',
    aliases: ['光點台北', '光點電影院', 'SPOT Cinema'],
    cinemaAliases: ['SPOT Taipei', '光點台北', '台北之家'],
    seatCount: 83,
    wheelchairSeats: 2,
    seatCountBasis: 'includes-wheelchair',
    screenWidthM: 4.7,
    screenHeightM: 1.85,
    format: 'DCP / 35mm / 16mm',
    modelId: 'spot-taipei',
    sourceUrls: [
      'https://www.spot.org.tw/venues/images/movie_seat.pdf',
      'https://www.spot.org.tw/venues/venue.html',
    ],
    checkedAt: '2026-11-15',
  },
  {
    slug: 'spot-huashan-a-one',
    cinemaSlug: 'spot-huashan',
    cinemaName: '光點華山電影館',
    brand: 'SPOT',
    city: '臺北市',
    hallName: '1廳 A One',
    aliases: ['1廳', 'A One', 'A1', '第一廳'],
    cinemaAliases: ['光點華山', 'SPOT Huashan'],
    seatCount: 175,
    seatCountBasis: 'unspecified',
    screenWidthM: 8.8,
    screenHeightM: 3.8,
    format: 'BARCO DP4K / DCP',
    sourceUrls: ['https://www.spot-hs.org.tw/venue/venue.html'],
    checkedAt: '2026-11-16',
  },
  {
    slug: 'spot-huashan-a-two',
    cinemaSlug: 'spot-huashan',
    cinemaName: '光點華山電影館',
    brand: 'SPOT',
    city: '臺北市',
    hallName: '2廳 A Two',
    aliases: ['2廳', 'A Two', 'A2', '第二廳'],
    cinemaAliases: ['光點華山', 'SPOT Huashan'],
    seatCount: 133,
    seatCountBasis: 'unspecified',
    screenWidthM: 8.6,
    screenHeightM: 3.4,
    format: 'BARCO DP4K / DCP',
    sourceUrls: ['https://www.spot-hs.org.tw/venue/venue.html'],
    checkedAt: '2026-11-16',
  },
  {
    slug: 'kfa-3f',
    cinemaSlug: 'kaohsiung-film-archive',
    cinemaName: '高雄市電影館',
    brand: 'KFA',
    city: '高雄市',
    hallName: '3F 放映廳',
    aliases: ['3F', '三樓放映廳', '3F放映廳'],
    cinemaAliases: ['高雄電影館', '高雄市電影館'],
    seatCount: 118,
    wheelchairSeats: 2,
    seatCountBasis: 'includes-wheelchair',
    format: '主題影展／藝術電影',
    sourceUrls: ['https://kfa.kcg.gov.tw/tw/guide'],
    checkedAt: '2026-11-15',
  },
  {
    slug: 'kfa-2f',
    cinemaSlug: 'kaohsiung-film-archive',
    cinemaName: '高雄市電影館',
    brand: 'KFA',
    city: '高雄市',
    hallName: '2F 小型放映室',
    aliases: ['2F', '小型放映室', '二樓小型放映室'],
    cinemaAliases: ['高雄電影館', '高雄市電影館'],
    seatCount: 32,
    seatCountBasis: 'unspecified',
    format: '小型放映室',
    sourceUrls: ['https://kfa.kcg.gov.tw/tw/guide'],
    checkedAt: '2026-11-15',
  },
  {
    slug: 'nwac-reel-one',
    cinemaSlug: 'neiwei-art-center',
    cinemaName: '內惟藝術中心',
    brand: '內惟藝術中心',
    city: '高雄市',
    hallName: 'Reel ONE 1廳',
    hallNameEn: 'Reel ONE',
    aliases: ['Reel ONE', 'Reel 1', '1廳'],
    cinemaAliases: ['內惟藝術中心', '內惟電影館', 'NWAC'],
    seatCount: 141,
    wheelchairSeats: 4,
    seatCountBasis: 'includes-wheelchair',
    format: '4K Barco Laser / Dolby 7.1 / 35mm',
    sourceUrls: ['https://www.nwac.org.tw/tw/cinema'],
    checkedAt: '2026-11-15',
  },
  {
    slug: 'nwac-reel-two',
    cinemaSlug: 'neiwei-art-center',
    cinemaName: '內惟藝術中心',
    brand: '內惟藝術中心',
    city: '高雄市',
    hallName: 'Reel TWO 2廳',
    hallNameEn: 'Reel TWO',
    aliases: ['Reel TWO', 'Reel 2', '2廳'],
    cinemaAliases: ['內惟藝術中心', '內惟電影館', 'NWAC'],
    seatCount: 64,
    wheelchairSeats: 2,
    seatCountBasis: 'includes-wheelchair',
    format: '4K Barco Laser / Dolby 7.1',
    sourceUrls: ['https://www.nwac.org.tw/tw/cinema'],
    checkedAt: '2026-11-15',
  },
]

export function normaliseDirectoryName(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, '')
}

/** Resolve a hall name only WITHIN its cinema: 1廳 is never globally unique. */
export function resolveHallAlias(cinemaSlug: string, candidate: string): DirectoryHall | undefined {
  const key = normaliseDirectoryName(candidate)
  if (!key) return undefined
  return cinemaDirectory.find(
    (hall) =>
      hall.cinemaSlug === cinemaSlug &&
      [hall.hallName, hall.hallNameEn ?? '', hall.slug, ...hall.aliases].some(
        (name) => normaliseDirectoryName(name) === key,
      ),
  )
}

export function searchCinemaDirectory(query: string): DirectoryHall[] {
  const key = normaliseDirectoryName(query.trim())
  if (!key) return cinemaDirectory
  return cinemaDirectory.filter((hall) =>
    [
      hall.cinemaSlug,
      hall.slug,
      hall.cinemaName,
      hall.cinemaNameEn ?? '',
      hall.city,
      hall.brand,
      hall.hallName,
      hall.hallNameEn ?? '',
      ...hall.cinemaAliases,
      ...hall.aliases,
    ].some((value) => normaliseDirectoryName(value).includes(key)),
  )
}

export function directoryHallName(hall: DirectoryHall, language: string) {
  return language === 'en-GB' ? (hall.hallNameEn ?? hall.hallName) : hall.hallName
}
export function directoryCinemaName(hall: DirectoryHall, language: string) {
  return language === 'en-GB' ? (hall.cinemaNameEn ?? hall.cinemaName) : hall.cinemaName
}
