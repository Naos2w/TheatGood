import { chainCinemas } from '../cinemas/chain-directory'
import { cinemaDirectory } from '../auditoriums/directory'
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
export type Source3DBrand = 'vieshow' | 'showtime' | 'miranew' | 'independent'
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
    | 'curated-auditorium'
}
export interface Source3DEntry {
  id: string
  label: string
  detail: string
  count: number
  path: string
  type: 'source-hall' | 'observed-pattern' | 'curated-hall'
  alert?: 'capacity-different' | 'capacity-unpublished'
}

const independentModelIds = new Set(['tfai-small', 'spot-taipei'])
export const independentSourced3DHalls = cinemaDirectory.filter(
  (hall) => hall.modelId && independentModelIds.has(hall.modelId),
)

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
  for (const hall of independentSourced3DHalls) {
    listed.push({
      key: 'independent|' + hall.slug,
      slug: hall.slug,
      brand: 'independent',
      name: hall.cinemaName,
      sourceCount: 1,
      evidence: 'curated-auditorium',
    })
  }
  return listed
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

export function independentSource3DEntries(slug: string): Source3DEntry[] {
  return independentSourced3DHalls
    .filter((item) => item.slug === slug && item.modelId)
    .map((item) => ({
      id: item.modelId!,
      label: item.hallName,
      detail: '已建立來源座位模型；室內排距仍為估算',
      count: item.seatCount,
      path: '/auditoriums/' + item.modelId,
      type: 'curated-hall',
    }))
}
