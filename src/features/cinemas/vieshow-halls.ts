/**
 * Verified factual *counts per numbered hall* from the official May 2026
 * Vie Show corporate group-booking seat-count sheet, p. 2.
 *
 * Source: https://www.vscinemas.com.tw/upload/biz/biz_20260528001.pdf
 * Sheet date: 2026-05-21. Not necessarily the latest seat configuration.
 *
 * The published table omits hall 4 and includes some non-numeric GC/format
 * cells; no missing halls or counts are inferred. These numbers are NOT a
 * seating plan, seat identifiers, wheelchair inclusion, screen size, format
 * availability or verified 3D geometry. Link to the original for revisions.
 */
import { chainCinemas } from './chain-directory'

export const VIESHOW_HALL_SOURCE = 'https://www.vscinemas.com.tw/upload/biz/biz_20260528001.pdf'
export const VIESHOW_HALL_SOURCE_DATE = '2026-05-21'

export interface PublishedHallCount {
  cinemaSlug: string
  hallNumber: number
  publishedSeatCount: number
  sourceUrl: string
  sourceDate: string
  dataLevel: 'published-count-only'
}

/**
 * Source columns in PDF order. The 2026 PDF labels iFG as 大魯閣新時代,
 * its former shopping-centre name. The operator currently calls it
 * 台中 iFG 遠雄廣場 and confirms the same nine halls / 1,781 seats.
 */
const cinemaColumns = [
  'vieshow-muvie-taipei-a13',
  'vieshow-taipei-hsinyi',
  'vieshow-taipei-qsquare',
  'vieshow-nangang-lalaport',
  'vieshow-taipei-ximen',
  'vieshow-banqiao-megacity',
  'vieshow-xindian-yulon',
  'vieshow-zhonghe-global',
  'vieshow-linkou-mitsui',
  'vieshow-taoyuan-tonlin',
  'vieshow-taoyuan-geleven',
  'vieshow-hsinchu-fe21',
  'vieshow-hsinchu-bigcity',
  'vieshow-toufen-shangshun',
  'vieshow-taichung-topcity',
  'vieshow-muvie-taichung-tigercity',
  'vieshow-taichung-ifg',
  'vieshow-tainan-fe21',
  'vieshow-tainan-tsmall',
  'vieshow-tainan-focus',
  'vieshow-kaohsiung-fe21',
  'vieshow-hualien-paradiso',
] as const

/** Each line: hall number, then 22 official per-location cells. "-" = blank,
 * GC1/GC2 = a published classification, not a numerical seat count. */
const sourceRows = [
  '1|48|174|227|74|159|183|114|94|144|52|114|151|293|207|389|174|280|140|178|73|92|368',
  '2|85|140|181|88|114|266|114|151|239|43|114|151|268|171|334|206|242|171|278|73|131|42',
  '3|74|169|142|76|49|215|180|197|243|49|114|116|285|231|291|230|190|177|221|68|264|108',
  '5|175|227|176|76|70|173|125|197|243|48|44|131|293|210|177|206|191|171|278|73|287|124',
  '6|391|150|324|204|62|396|95|197|140|52|-|280|266|231|185|247|157|171|221|73|121|108',
  '7|85|150|176|81|143|294|184|167|243|41|-|278|323|210|216|161|275|177|279|68|110|-',
  '8|74|228|145|80|131|234|220|80|243|45|-|242|271|183|185|207|160|171|163|73|91|-',
  '9|195|228|176|66|141|176|132|84|236|35|-|159|217|183|-|219|143|171|424|73|90|-',
  '10|-|254|222|66|123|112|145|75|125|129|-|312|-|-|-|-|143|177|-|68|109|-',
  '11|-|254|-|74|-|-|220|118|-|60|-|-|-|-|-|-|-|-|74|-|131|-',
  '12|-|244|-|88|-|-|185|-|-|43|-|-|-|-|-|-|-|-|126|-|287|-',
  '13|-|121|-|76|-|-|120|-|-|36|-|-|-|-|-|-|-|-|75|-|287|-',
  '14|-|112|-|76|-|-|141|-|-|37|-|-|-|-|-|-|-|-|53|-|121|-',
  '15|-|118|-|81|-|-|380|-|-|41|-|-|-|-|-|-|-|-|68|-|110|-',
  '16|-|112|-|80|-|-|-|-|-|45|-|GC1|-|-|-|GC1|-|-|GC1|-|GC1|-',
  '17|-|-|-|66|-|-|-|-|-|35|-|52|-|-|-|31|-|-|40|-|32|-',
  '18|-|-|-|66|-|-|-|-|-|51|-|GC2|-|-|-|GC2|-|-|GC2|-|GC2|-',
  '19|-|-|-|-|-|-|-|-|-|48|-|35|-|-|-|41|-|-|40|-|30|-',
] as const

function parseOfficialHallCounts(): PublishedHallCount[] {
  const venues = new Set(chainCinemas.map((cinema) => cinema.slug))
  if (cinemaColumns.length !== 22 || cinemaColumns.some((slug) => !venues.has(slug))) {
    throw new Error('Vie Show sheet columns do not match the current cinema directory')
  }
  const records: PublishedHallCount[] = []
  for (const line of sourceRows) {
    const cells = line.split('|')
    if (cells.length !== cinemaColumns.length + 1) {
      throw new Error('Unexpected number of columns in official Vie Show seat-count sheet')
    }
    const hallNumber = Number(cells[0])
    for (let index = 0; index < cinemaColumns.length; index++) {
      const raw = cells[index + 1]
      if (!raw || !/^\d+$/.test(raw)) continue
      const count = Number(raw)
      if (count <= 0 || count > 1500) throw new Error('Invalid official count')
      records.push({
        cinemaSlug: cinemaColumns[index]!,
        hallNumber,
        publishedSeatCount: count,
        sourceUrl: VIESHOW_HALL_SOURCE,
        sourceDate: VIESHOW_HALL_SOURCE_DATE,
        dataLevel: 'published-count-only',
      })
    }
  }
  return records
}

export const publishedVieshowHalls = parseOfficialHallCounts()

export function publishedHallsForCinema(cinemaSlug: string): PublishedHallCount[] {
  return publishedVieshowHalls.filter((entry) => entry.cinemaSlug === cinemaSlug)
}

export function publishedSeatTotal(cinemaSlug: string): number {
  return publishedHallsForCinema(cinemaSlug).reduce(
    (total, hall) => total + hall.publishedSeatCount,
    0,
  )
}
