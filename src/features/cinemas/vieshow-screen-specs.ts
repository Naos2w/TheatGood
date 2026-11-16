import type { VieShowArchivedLayout } from './vieshow-seat-archive'

export type ScreenDimensionSource = 'operator-published' | 'independent-secondary'

export interface VieShowScreenSpecification {
  cinemaSlug: string
  hallNumber: number
  /** The operator's published numbered capacity is used to cross-check the hall assignment. */
  expectedSeatCount: number
  format: string
  projection: string
  screenWidthM: number
  screenHeightM: number
  dimensionSource: ScreenDimensionSource
  dimensionSourceUrl: string
  hallIdentificationSourceUrl: string
  /**
   * The operator gives a format-specific seat capacity, and the archived
   * numbered hall has the same count. The operator has not explicitly paired
   * that format with the numbered hall in our saved sources.
   */
  identification: 'capacity-cross-reference'
  note: string
}

/**
 * Only records with stated silver-screen dimensions and a defensible hall
 * cross-reference. Other halls remain entirely estimated, never filled with
 * copied dimensions from an unrelated theatre.
 */
export const vieShowScreenSpecifications: readonly VieShowScreenSpecification[] = [
  {
    cinemaSlug: 'vieshow-muvie-taipei-a13',
    hallNumber: 6,
    expectedSeatCount: 391,
    format: 'TITAN SCREEN',
    projection: '4K RGB laser / 7.1-channel sound',
    screenWidthM: 22,
    screenHeightM: 12,
    dimensionSource: 'operator-published',
    dimensionSourceUrl: 'https://www.vscinemas.com.tw/about/',
    hallIdentificationSourceUrl: 'https://www.vscinemas.com.tw/theater/detail2.aspx?id=23',
    identification: 'capacity-cross-reference',
    note: 'Vie Show publishes a 22 × 12 m TITAN screen and a 391-seat TITAN auditorium. Public seating identifies Screen 6 with 391 labelled seats; the numbered-hall mapping is capacity-based rather than an explicit technical floor plan.',
  },
  {
    cinemaSlug: 'vieshow-banqiao-megacity',
    hallNumber: 6,
    expectedSeatCount: 396,
    format: 'IMAX with Laser',
    projection: 'IMAX laser',
    screenWidthM: 21.33,
    screenHeightM: 11.46,
    dimensionSource: 'independent-secondary',
    dimensionSourceUrl: 'https://reelax.app/halls',
    hallIdentificationSourceUrl: 'https://www.vscinemas.com.tw/theater/detail.aspx?id=4',
    identification: 'capacity-cross-reference',
    note: 'Vie Show publishes one 396-seat IMAX screen at Banciao; the saved Screen 6 has 396 seats. The 21.33 × 11.46 m screen measurements come from an independent specialist directory, not the operator.',
  },
]

export function vieShowScreenSpecification(
  cinemaSlug: string,
  layout: Pick<VieShowArchivedLayout, 'hallNumber' | 'ordinarySeatCount'>,
): VieShowScreenSpecification | undefined {
  return vieShowScreenSpecifications.find(
    (item) =>
      item.cinemaSlug === cinemaSlug &&
      item.hallNumber === layout.hallNumber &&
      item.expectedSeatCount === layout.ordinarySeatCount,
  )
}
