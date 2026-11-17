import { describe, expect, it } from 'vitest'
import {
  filterWatchHistory,
  makeManualDraft,
  summariseWatchHistory,
  todayInTaipei,
  watchCinemaOptions,
  watchHallOptions,
  watchPreviewRoute,
  type ManualWatchDraft,
  type ManualWatchEntry,
} from './manual-history'

const base: ManualWatchDraft = {
  movieTitle: '自己取的電影名稱',
  watchedOn: '2026-11-15',
  cinemaSlug: 'spot-taipei',
  cinemaName: '光點台北電影館',
  hallName: '光點電影院',
  seatLabel: '1-1',
  modelId: 'spot-taipei',
  modelVersion: 1,
  manualEntry: true,
  screeningId: null,
}
const record = (overrides: Partial<ManualWatchEntry> = {}): ManualWatchEntry => ({
  ...base,
  id: '7112d1c3-55d9-4cf4-9fa2-f9bb0ad60d12',
  createdAt: '2026-11-16T00:00:00.000Z',
  updatedAt: '2026-11-16T00:00:00.000Z',
  ...overrides,
})

describe('free-text manual viewing footprint', () => {
  it('does not require a TMDB film, a live screening, or a real release date', () => {
    expect(makeManualDraft(base).movieTitle).toBe('自己取的電影名稱')
    expect(makeManualDraft({ ...base, watchedOn: '1992-02-29' }).watchedOn).toBe('1992-02-29')
    expect(
      makeManualDraft({
        ...base,
        cinemaSlug: null,
        cinemaName: '自訂電影院',
        hallName: '不知名的廳',
        seatLabel: '',
        modelId: null,
        modelVersion: null,
      }).screeningId,
    ).toBeNull()
    expect(() => makeManualDraft({ ...base, movieTitle: '  ' })).toThrow()
    expect(() => makeManualDraft({ ...base, watchedOn: '2026-02-30' })).toThrow()
  })

  it('offers operator or verified directory halls without inventing seat maps', () => {
    expect(watchCinemaOptions).toHaveLength(45)
    expect(watchHallOptions('vieshow-taipei-hsinyi')).toHaveLength(15)
    expect(watchHallOptions('vieshow-taipei-hsinyi').find((hall) => hall.name === '12 廳')).toEqual(
      {
        name: '12 廳',
        modelId: 'vieshow-hsinyi-12',
      },
    )
    expect(watchHallOptions('miramar-dazhi')).toHaveLength(10)
    expect(watchHallOptions('showtime-taipei-dome')).toEqual([])
    const cinema = watchHallOptions('spot-taipei')
    expect(cinema).toHaveLength(1)
    expect(cinema[0]).toEqual({ name: '光點電影院', modelId: 'spot-taipei' })
    expect(watchHallOptions('nonexistent')).toEqual([])
  })

  it('reopens only real existing seat positions from unchanged official models', () => {
    expect(watchPreviewRoute(record())).toEqual({
      path: '/auditoriums/spot-taipei',
      query: { seat: '1-1' },
    })
    expect(watchPreviewRoute(record({ seatLabel: 'H12' }))).toBeNull()
    expect(watchPreviewRoute(record({ modelVersion: 2 }))).toBeNull()
    expect(watchPreviewRoute(record({ cinemaSlug: 'vieshow-taipei-hsinyi' }))).toBeNull()
    expect(watchPreviewRoute(record({ modelId: null }))).toBeNull()
  })

  it('counts individual visits and preserves distinct user-entered film names', () => {
    const entries = [
      record(),
      record({
        id: '7112d1c3-55d9-4cf4-9fa2-f9bb0ad60d13',
        watchedOn: '2026-10-01',
        seatLabel: '2-2',
      }),
      record({
        id: '7112d1c3-55d9-4cf4-9fa2-f9bb0ad60d14',
        watchedOn: '2025-10-01',
        movieTitle: '自己取的電影名稱 2',
        cinemaName: '另一家影城',
        cinemaSlug: null,
        hallName: 'A廳',
        seatLabel: '',
      }),
    ]
    expect(summariseWatchHistory(entries)).toEqual({
      viewings: 3,
      films: 2,
      cinemas: 2,
      auditoriums: 2,
      seats: 2,
    })
    expect(filterWatchHistory(entries, { query: '自己取的電影', year: '2026' })).toHaveLength(2)
    expect(filterWatchHistory(entries, { query: 'A廳' })).toHaveLength(1)
    expect(filterWatchHistory(entries, { cinema: 'spot-taipei' })).toHaveLength(2)
    expect(filterWatchHistory(entries).map((x) => x.watchedOn)).toEqual([
      '2026-11-15',
      '2026-10-01',
      '2025-10-01',
    ])
    expect(entries[0]?.watchedOn).toBe('2026-11-15')
  })

  it('uses the Taiwan calendar day at its UTC midnight boundary', () => {
    expect(todayInTaipei(new Date('2026-11-16T15:30:00.000Z'))).toBe('2026-11-16')
    expect(todayInTaipei(new Date('2026-11-16T16:30:00.000Z'))).toBe('2026-11-17')
  })
})
