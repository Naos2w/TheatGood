import { chainCinemas } from '../cinemas/chain-directory'
import { broadwayPublicSeatLayouts } from '../cinemas/broadway-seat-layouts'
import { centuryasiaPublicSeatLayouts } from '../cinemas/centuryasia-seat-layouts'
import { in89InstitutionSeatCharts } from '../cinemas/in89-public-seat-chart'
import { miranewSeatReferences } from '../cinemas/official-seat-layouts'
import {
  vieShowCoverageForCinema,
  type VieShowArchivedLayout,
} from '../cinemas/vieshow-seat-archive'
import type { ShowtimeLocalResearchIndex } from './showtime-local-research'

/**
 * Catalogue counts SOURCED seat-layout entries, not permanent physical halls.
 * Never infer missing seat positions from a published capacity.
 */
export type Source3DBrand = 'vieshow' | 'showtime' | 'miranew' | 'broadway' | 'centuryasia' | 'in89'
export interface Source3DVenue {
  key: string
  slug: string
  brand: Source3DBrand
  name: string
  sourceCount: number | null
  evidence:
    | 'public-operator-grid'
    | 'private-verified-grid'
    | 'unnumbered-public-pattern'
    | 'dated-public-institution-chart'
}
export interface Source3DEntry {
  id: string
  label: string
  detail: string
  count: number
  path: string
  type: 'source-hall' | 'observed-pattern'
  alert?: 'capacity-different' | 'capacity-unpublished'
}

export function source3DVenues(showtime?: ShowtimeLocalResearchIndex | null): Source3DVenue[] {
  const listed: Source3DVenue[] = []
  for (const cinema of chainCinemas) {
    if (cinema.brand === 'vieshow') {
      const count = vieShowCoverageForCinema(cinema.slug)?.observedLabels ?? 0
      if (!count) continue
      listed.push({
        key: 'vieshow|' + cinema.slug,
        slug: cinema.slug,
        brand: 'vieshow',
        name: cinema.name,
        sourceCount: count,
        evidence: 'public-operator-grid',
      })
    } else if (cinema.brand === 'showtime') {
      listed.push({
        key: 'showtime|' + cinema.slug,
        slug: cinema.slug,
        brand: 'showtime',
        name: cinema.name,
        sourceCount: showtime ? (showtime.venues[cinema.slug]?.length ?? 0) : null,
        evidence: 'private-verified-grid',
      })
    } else if (cinema.brand === 'in89') {
      const count = in89InstitutionSeatCharts.filter(
        (item) => item.cinemaSlug === cinema.slug,
      ).length
      if (!count) continue
      listed.push({
        key: 'in89|' + cinema.slug,
        slug: cinema.slug,
        brand: 'in89',
        name: cinema.name,
        sourceCount: count,
        evidence: 'dated-public-institution-chart',
      })
    } else if (cinema.brand === 'broadway' || cinema.brand === 'centuryasia') {
      const count = [...broadwayPublicSeatLayouts, ...centuryasiaPublicSeatLayouts].filter(
        (item) => item.cinemaSlug === cinema.slug,
      ).length
      if (!count) continue
      listed.push({
        key: cinema.brand + '|' + cinema.slug,
        slug: cinema.slug,
        brand: cinema.brand,
        name: cinema.name,
        sourceCount: count,
        evidence: 'public-operator-grid',
      })
    } else if (cinema.brand === 'miranew') {
      const count = miranewSeatReferences.filter((item) => item.cinemaSlug === cinema.slug).length
      if (!count) continue
      listed.push({
        key: 'miranew|' + cinema.slug,
        slug: cinema.slug,
        brand: 'miranew',
        name: cinema.name,
        sourceCount: count,
        evidence: 'unnumbered-public-pattern',
      })
    }
  }
  return listed
}

/** Chain venues without a complete source-backed 3D preview remain explicitly pending. */
export function pendingChain3DVenues(): (typeof chainCinemas)[number][] {
  const supported = new Set(source3DVenues().map((venue) => venue.slug))
  return chainCinemas.filter((venue) => !supported.has(venue.slug))
}

export function source3DTotalByBrand(
  venues: readonly Source3DVenue[],
  brand: Source3DBrand,
): number | null {
  const eligible = venues.filter((venue) => venue.brand === brand)
  return eligible.some((venue) => venue.sourceCount === null)
    ? null
    : eligible.reduce((count, venue) => count + (venue.sourceCount ?? 0), 0)
}

export function vieShowSource3DEntries(
  cinemaSlug: string,
  layouts: readonly VieShowArchivedLayout[],
): Source3DEntry[] {
  return layouts.map((layout) => ({
    id: layout.id,
    label: layout.hallLabel,
    detail: layout.countComparison === 'different' ? '席數差異，來源格線保留' : '來源座位排列',
    count: layout.ordinarySeatCount,
    path: '/cinemas/' + cinemaSlug + '/halls/' + encodeURIComponent(layout.id),
    type: 'source-hall',
    alert:
      layout.countComparison === 'different'
        ? 'capacity-different'
        : layout.countComparison === 'not-published'
          ? 'capacity-unpublished'
          : undefined,
  }))
}

export function broadwaySource3DEntries(cinemaSlug: string): Source3DEntry[] {
  return broadwayPublicSeatLayouts
    .filter((item) => item.cinemaSlug === cinemaSlug)
    .map((item) => ({
      id: item.id,
      label: item.hallLabel,
      detail: '百老匯官方 QUICK VIEW 完整座位格線，空間尺度估算',
      count: item.ordinarySeatCount,
      path: '/cinemas/' + cinemaSlug + '/halls/' + encodeURIComponent(item.id),
      type: 'source-hall' as const,
    }))
}

export function centuryasiaSource3DEntries(cinemaSlug: string): Source3DEntry[] {
  return centuryasiaPublicSeatLayouts
    .filter((item) => item.cinemaSlug === cinemaSlug)
    .map((item) => ({
      id: item.id,
      label: item.hallLabel,
      detail: '喜樂時代官方場次座位預覽，空間尺度估算',
      count: item.ordinarySeatCount,
      path: '/cinemas/' + cinemaSlug + '/halls/' + encodeURIComponent(item.id),
      type: 'source-hall' as const,
    }))
}

export function in89PublicChartEntries(cinemaSlug: string): Source3DEntry[] {
  return in89InstitutionSeatCharts
    .filter((item) => item.cinemaSlug === cinemaSlug)
    .map((item) => ({
      id: item.id,
      label: item.hallLabel + '（2026年初來源）',
      detail: '公開學校活動座圖；2026年11月官方總位置數相符，當前座位格線未實測',
      count: item.ordinarySeatCount,
      path: '/cinemas/' + cinemaSlug + '/halls/' + encodeURIComponent(item.id),
      type: 'source-hall' as const,
    }))
}

export function miranewSource3DEntries(cinemaSlug: string): Source3DEntry[] {
  return miranewSeatReferences
    .filter((item) => item.cinemaSlug === cinemaSlug)
    .map((item, index) => ({
      id: item.id,
      label: item.publishedHallLabel + ' · 座型 ' + (index + 1),
      detail: '公開座型，未確認永久實體廳號',
      count: item.totalSeatLabels,
      path: '/cinemas/' + cinemaSlug + '/seat-patterns/' + encodeURIComponent(item.id),
      type: 'observed-pattern' as const,
    }))
}

export function showtimeSource3DEntries(
  cinemaSlug: string,
  index: ShowtimeLocalResearchIndex | null,
): Source3DEntry[] {
  if (!index?.localDeviceOnly || index.approvedForPublicUI !== false) return []
  return (index.venues[cinemaSlug] ?? []).map((hall) => ({
    id: cinemaSlug + '|' + hall.hallLabel,
    label: hall.hallLabel,
    detail: '逐場次核實來源；室內尺寸估算',
    count: hall.ordinarySeatCount,
    path: '/cinemas/' + cinemaSlug + '/halls/' + encodeURIComponent(hall.hallLabel),
    type: 'source-hall',
  }))
}
