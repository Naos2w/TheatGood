import { describe, expect, it } from 'vitest'
import {
  filterWatchHistory,
  makeManualDraft,
  summariseWatchHistory,
  todayInTaipei,
  watchCinemaOptions,
  watchHallOptions,
  watchPreviewRoute,
  watchVieShowPreviewRoute,
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

  it('reopens a sourced Vie Show or MUVIE seat only when its archived hall and label still match', async () => {
    const archived = (cinemaSlug: string, hallName: string, seatLabel: string) =>
      record({
        cinemaSlug,
        cinemaName: '測試威秀影城',
        hallName,
        seatLabel,
        modelId: null,
        modelVersion: null,
      })
    const hsinyi = archived('vieshow-taipei-hsinyi', '11 廳', 'G08')
    expect(await watchVieShowPreviewRoute(hsinyi)).toEqual({
      path: '/cinemas/vieshow-taipei-hsinyi/halls/vieshow-taipei-hsinyi-11',
      query: { seat: 'G08', view: '3d' },
    })
    expect(
      await watchVieShowPreviewRoute(archived('vieshow-taipei-hsinyi', '第11廳', 'G08')),
    ).toEqual(await watchVieShowPreviewRoute(hsinyi))
    expect(
      await watchVieShowPreviewRoute(archived('vieshow-hualien-paradiso', '第B廳', 'E12')),
    ).toEqual({
      path: '/cinemas/vieshow-hualien-paradiso/halls/vieshow-hualien-paradiso-b',
      query: { seat: 'E12', view: '3d' },
    })
    expect(
      await watchVieShowPreviewRoute(archived('vieshow-hsinchu-fe21', 'GC1', 'D06')),
    ).toEqual({
      path: '/cinemas/vieshow-hsinchu-fe21/halls/vieshow-hsinchu-fe21-gc1',
      query: { seat: 'D06', view: '3d' },
    })
    // The legacy festival screen 12 model must never be inferred from a
    // source-archived screen 12 record with an explicitly absent model ID.
    expect(
      await watchVieShowPreviewRoute(archived('vieshow-taipei-hsinyi', '12 廳', 'I01')),
    ).toEqual({
      path: '/cinemas/vieshow-taipei-hsinyi/halls/vieshow-taipei-hsinyi-12',
      query: { seat: 'I01', view: '3d' },
    })
    for (const entry of [
      archived('vieshow-taipei-hsinyi', '11 廳', 'FAKE999'),
      archived('vieshow-taipei-hsinyi', '13 廳', 'G08'),
      archived('vieshow-hualien-paradiso', 'B廳', 'E12'),
      archived('vieshow-hualien-paradiso', '第B廳', ''),
      archived('nonexistent', '11 廳', 'G08'),
      archived('spot-taipei', '11 廳', 'G08'),
      { ...hsinyi, modelId: 'vieshow-hsinyi-12', modelVersion: 1 },
      { ...hsinyi, modelVersion: 1 },
    ]) {
      expect(await watchVieShowPreviewRoute(entry)).toBeNull()
    }
    // Existing versioned catalogue links must continue to work as before.
    expect(watchPreviewRoute(record())).toEqual({
      path: '/auditoriums/spot-taipei',
      query: { seat: '1-1' },
    })
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
