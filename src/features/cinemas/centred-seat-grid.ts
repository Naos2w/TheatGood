import type { VieShowArchivedLayout } from './vieshow-seat-archive'

export interface CentredSeatGrid {
  width: number
  height: number
  occupiedWidth: number
  minColumn: number
  maxColumn: number
  screenStartX: number
  screenEndX: number
  seatX: (column: number) => number
  labelX: (column: number) => number
}

/**
 * The official booking table can have large blank columns outside the actual
 * seating bank. Centre the *occupied* columns, not the original table width.
 * One shared transform applies to seats, wheelchair markers and the screen line.
 */
export function centreSeatGrid(
  layout: Pick<VieShowArchivedLayout, 'seatPositions' | 'wheelchairPositions' | 'gridRows'>,
  cellWidth = 30,
  cellHeight = 31,
  minWidth = 560,
): CentredSeatGrid {
  const columns = [
    ...layout.seatPositions.map((seat) => seat[2]),
    ...layout.wheelchairPositions.map((position) => position[1]),
  ]
  if (!columns.length) throw new Error('Cannot centre a seating chart with no positions')
  if (!(cellWidth > 0 && cellHeight > 0 && minWidth > 0)) {
    throw new RangeError('Seating chart dimensions must be positive')
  }
  const minColumn = Math.min(...columns)
  const maxColumn = Math.max(...columns)
  const occupiedWidth = (maxColumn - minColumn) * cellWidth + 26
  const width = Math.max(minWidth, occupiedWidth + 64)
  const height = Math.max(210, layout.gridRows * cellHeight + 77)
  const leftX = (width - occupiedWidth) / 2
  const screenWidth = Math.min(width - 96, occupiedWidth * 0.94)

  return {
    width,
    height,
    occupiedWidth,
    minColumn,
    maxColumn,
    screenStartX: (width - screenWidth) / 2,
    screenEndX: (width + screenWidth) / 2,
    seatX: (column) => leftX + (column - minColumn) * cellWidth,
    labelX: (column) => leftX + (column - minColumn) * cellWidth + 13,
  }
}
