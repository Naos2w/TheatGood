import { describe, expect, it } from 'vitest'
import type { ManualWatchEntry } from '../src/features/history/manual-history'
import { fromCloudWatchLogRow, toCloudWatchLogRow } from './watch-history-mapping'

const record: ManualWatchEntry = {
  id: '7112d1c3-55d9-4cf4-9fa2-000000000015',
  movieTitle: '不依賴上映檔期',
  watchedOn: '2026-11-16',
  cinemaSlug: 'vieshow-muvie-taipei-a13',
  cinemaName: 'MUVIE CINEMAS 台北松仁',
  hallName: '第 6 廳',
  seatLabel: 'B02',
  modelId: null,
  modelVersion: null,
  manualEntry: true,
  screeningId: null,
  createdAt: '2026-11-16T15:58:00.000Z',
  updatedAt: '2026-11-18T04:10:00.000Z',
}

describe('cloud/manual history database contract (no live DB writes)', () => {
  it('preserves the calendar date, original UUID, cinema, seat and local model identity', () => {
    const typed = toCloudWatchLogRow(record)
    expect(typed).not.toHaveProperty('userId')
    expect(typed.id).toBe(record.id)
    expect(typed.watchedOn).toBe('2026-11-16')
    expect(typed.watchedAt?.toISOString()).toBe('2026-11-16T04:00:00.000Z')
    expect(typed.movieTitle).toBe(record.movieTitle)
    expect(typed.cinemaSlug).toBe(record.cinemaSlug)
    expect(typed.auditoriumName).toBe(record.hallName)
    expect(typed.seatLabel).toBe(record.seatLabel)
    expect(typed.screeningId).toBeNull()

    const restored = fromCloudWatchLogRow({
      id: record.id,
      watchedOn: typed.watchedOn!,
      movieTitle: typed.movieTitle,
      cinemaName: typed.cinemaName!,
      cinemaSlug: typed.cinemaSlug!,
      auditoriumName: typed.auditoriumName!,
      seatLabel: typed.seatLabel!,
      localModelId: typed.localModelId!,
      localModelVersion: typed.localModelVersion!,
      manualEntry: true,
      screeningId: null,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
    })
    expect(restored).toEqual(record)
  })

  it('retains versioned local model links without mistaking them for DB UUID foreign keys', () => {
    const withModel = {
      ...record,
      modelId: 'spot-taipei',
      modelVersion: 1,
      cinemaSlug: 'spot-taipei',
      hallName: '光點電影院',
    }
    const mapped = toCloudWatchLogRow(withModel)
    expect(mapped.localModelId).toBe('spot-taipei')
    expect(mapped.localModelVersion).toBe(1)
    expect(mapped.modelVersionId).toBeNull()
  })

  it('refuses broken local records and legacy/nonmanual cloud rows that lack lossless fields', () => {
    expect(() => toCloudWatchLogRow({ ...record, watchedOn: '2026-02-30' })).toThrow()
    const base = {
      id: record.id,
      watchedOn: record.watchedOn,
      movieTitle: record.movieTitle,
      cinemaName: record.cinemaName,
      cinemaSlug: record.cinemaSlug,
      auditoriumName: record.hallName,
      seatLabel: record.seatLabel,
      localModelId: record.modelId,
      localModelVersion: record.modelVersion,
      manualEntry: true,
      screeningId: null,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
    }
    expect(() => fromCloudWatchLogRow({ ...base, watchedOn: null })).toThrow(/Legacy/)
    expect(() => fromCloudWatchLogRow({ ...base, updatedAt: null })).toThrow(/Legacy/)
    expect(() => fromCloudWatchLogRow({ ...base, screeningId: record.id })).toThrow(/Legacy/)
    expect(() => fromCloudWatchLogRow({ ...base, manualEntry: false })).toThrow(/Legacy/)
  })
})
