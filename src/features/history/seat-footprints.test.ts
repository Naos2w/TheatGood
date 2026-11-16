import { describe, expect, it } from 'vitest'
import { groupWatchFootprints, footstepVisitsForSeat } from './seat-footprints'
import type { ManualWatchEntry } from './manual-history'

const base: ManualWatchEntry = {
  id: 'd7f2312f-3fa4-4f62-9ca9-019128adaf01',
  movieTitle: '第一次看',
  watchedOn: '2026-11-16',
  cinemaSlug: 'spot-taipei',
  cinemaName: '光點台北電影館',
  hallName: '光點電影院',
  seatLabel: '1-1',
  modelId: 'spot-taipei',
  modelVersion: 1,
  manualEntry: true,
  screeningId: null,
  createdAt: '2026-11-16T01:00:00.000Z',
  updatedAt: '2026-11-16T01:00:00.000Z',
}

function another(idSuffix: string, updates: Partial<ManualWatchEntry> = {}): ManualWatchEntry {
  return { ...base, id: 'd7f2312f-3fa4-4f62-9ca9-019128adaf' + idSuffix, ...updates }
}

describe('personal cinema seating footprints', () => {
  it('only highlights actual seats of a current verified cinema model', () => {
    const groups = groupWatchFootprints([
      base,
      another('02', { movieTitle: '再看一次', watchedOn: '2026-11-14' }),
      another('03', { seatLabel: '2-2', movieTitle: '另一個位置' }),
    ])
    expect(groups).toHaveLength(1)
    const group = groups[0]!
    expect(group.modelId).toBe('spot-taipei')
    expect(group.modelSeats).toHaveLength(83)
    expect(group.visitedSeatCounts).toEqual({ '1-1': 2, '2-2': 1 })
    expect(group.textOnlySeats).toEqual([])
    expect(footstepVisitsForSeat(group, '1-1').map((x) => x.movieTitle)).toEqual([
      '第一次看',
      '再看一次',
    ])
    expect(footstepVisitsForSeat(group, '3-5')).toEqual([])
  })

  it('retains invalid, unverified and outdated entries as written text without fake highlights', () => {
    const groups = groupWatchFootprints([
      base,
      another('02', { seatLabel: 'H12' }),
      another('03', { seatLabel: 'H12', modelVersion: 2 }),
      another('04', { seatLabel: '1-1', modelVersion: 2 }),
    ])
    expect(groups[0]?.visitedSeatCounts).toEqual({ '1-1': 1 })
    expect(groups[0]?.textOnlySeats).toEqual([
      { label: 'H12', count: 2 },
      { label: '1-1', count: 1 },
    ])
    expect(footstepVisitsForSeat(groups[0]!, 'H12')).toEqual([])
  })

  it('never draws synthetic seats for commercial halls known only by capacity', () => {
    const groups = groupWatchFootprints([
      another('05', {
        cinemaSlug: 'vieshow-taipei-hsinyi',
        cinemaName: '台北信義威秀影城',
        hallName: '10 廳',
        seatLabel: 'G12',
        modelId: null,
        modelVersion: null,
      }),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({
      model: null,
      modelId: null,
      modelSeats: [],
      visitedSeatCounts: {},
      textOnlySeats: [{ label: 'G12', count: 1 }],
    })
  })

  it('keeps user-entered hall names separate and does not mistake another hall for a verified model', () => {
    const groups = groupWatchFootprints([
      base,
      another('02', { hallName: '自訂第 3 廳', seatLabel: '1-1' }),
    ])
    expect(groups).toHaveLength(2)
    const wrong = groups.find((group) => group.hallName === '自訂第 3 廳')!
    expect(wrong.modelId).toBeNull()
    expect(wrong.textOnlySeats).toEqual([{ label: '1-1', count: 1 }])
    expect(groups[0]?.visits[0]?.movieTitle).toBe('第一次看')
  })

  it('groups a known cinema by stable slug even when its display name changes', () => {
    const groups = groupWatchFootprints([
      base,
      another('02', { cinemaName: 'SPOT Taipei', seatLabel: '2-2' }),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0]?.visitedSeatCounts).toEqual({ '1-1': 1, '2-2': 1 })
  })

  it('does not mix footprints across different cinemas with identically named halls', () => {
    const groups = groupWatchFootprints([
      another('05', {
        cinemaSlug: null,
        cinemaName: '自訂影城 A',
        hallName: '第1廳',
        seatLabel: 'H8',
        modelId: null,
        modelVersion: null,
      }),
      another('06', {
        cinemaSlug: null,
        cinemaName: '自訂影城 B',
        hallName: '第1廳',
        seatLabel: 'H8',
        modelId: null,
        modelVersion: null,
      }),
    ])
    expect(groups).toHaveLength(2)
    expect(groups[0]?.key).not.toBe(groups[1]?.key)
  })
})
