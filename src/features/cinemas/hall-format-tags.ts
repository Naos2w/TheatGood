/**
 * Cinema-hall format badges. Never project a venue-level advertised format
 * onto an arbitrary numbered seating plan.
 *
 * A tag can either come directly from an operator's hall label (GC / Gold Class),
 * or from an explicitly marked capacity cross-reference (TITAN / IMAX).
 */
import type { VieShowArchivedLayout } from './vieshow-seat-archive'
import { vieShowScreenSpecification } from './vieshow-screen-specs'

export type HallTagConfidence = 'official-hall-label' | 'capacity-cross-reference'
export interface HallFormatTag {
  label: string
  confidence: HallTagConfidence
  sourceUrl: string
}

const GOLD_CLASS_VENUES: Readonly<Record<string, string>> = {
  'vieshow-hsinchu-fe21': 'https://www.vscinemas.com.tw/about/',
  'vieshow-muvie-taichung-tigercity': 'https://www.tigercity.com.tw/cinema/',
  'vieshow-tainan-tsmall': 'https://www.vscinemas.com.tw/about/',
  'vieshow-kaohsiung-fe21': 'https://www.vscinemas.com.tw/about/',
}

/** Only hall IDs directly named in the archived public ticketing previews. */
export function hallFormatTags(
  cinemaSlug: string,
  layout: Pick<VieShowArchivedLayout, 'hallLabel' | 'hallNumber' | 'ordinarySeatCount'>,
): HallFormatTag[] {
  const tags: HallFormatTag[] = []
  const hallLabel = layout.hallLabel.trim().toUpperCase().replace(/\s+/g, '')
  const goldClassSource = GOLD_CLASS_VENUES[cinemaSlug]
  if (goldClassSource && (/^GC\d{1,2}$/.test(hallLabel) || hallLabel === 'GOLDCLASS')) {
    tags.push({
      label: 'GOLD CLASS',
      confidence: 'official-hall-label',
      sourceUrl: goldClassSource,
    })
  }

  // This is not a certified hall-number mapping. Make the uncertainty visible.
  const screen = vieShowScreenSpecification(cinemaSlug, layout)
  if (screen) {
    tags.push({
      label: screen.format === 'TITAN SCREEN' ? 'TITAN' : 'IMAX',
      confidence: 'capacity-cross-reference',
      sourceUrl: screen.hallIdentificationSourceUrl,
    })
  }
  return tags
}
