import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useManualWatchHistoryStore, WATCH_HISTORY_STORAGE_KEY } from './manual-watch-history'
import type { ManualWatchDraft } from '../features/history/manual-history'

const draft: ManualWatchDraft = {
  movieTitle: '任意名稱，不要求上映',
  watchedOn: '2026-11-16',
  cinemaSlug: 'spot-taipei',
  cinemaName: '光點台北電影館',
  hallName: '光點電影院',
  seatLabel: '1-1',
  modelId: 'spot-taipei',
  modelVersion: 1,
  manualEntry: true,
  screeningId: null,
}
let nextId = 10
beforeEach(() => {
  window.localStorage.clear()
  setActivePinia(createPinia())
  nextId = 10
  vi.stubGlobal('crypto', {
    randomUUID: () => `7112d1c3-55d9-4cf4-9fa2-${String(nextId++).padStart(12, '0')}`,
  })
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('local-first manual viewing history store', () => {
  it('persists multiple visits for the same unverified film without a screening ID', () => {
    const store = useManualWatchHistoryStore()
    expect(store.add(draft)).toBe(true)
    expect(store.add({ ...draft, watchedOn: '2026-11-15', seatLabel: '2-2' })).toBe(true)
    expect(store.entries).toHaveLength(2)
    expect(store.entries.every((entry) => entry.screeningId === null && entry.manualEntry)).toBe(
      true,
    )

    const saved = JSON.parse(window.localStorage.getItem(WATCH_HISTORY_STORAGE_KEY)!)
    expect(saved.version).toBe(1)
    expect(saved.entries).toHaveLength(2)
    setActivePinia(createPinia())
    const loaded = useManualWatchHistoryStore()
    expect(loaded.entries).toHaveLength(2)
    expect(loaded.entries[0]?.movieTitle).toBe(draft.movieTitle)
  })

  it('edits a local record, preserves its id and removes only after confirmation', () => {
    const store = useManualWatchHistoryStore()
    expect(store.add(draft)).toBe(true)
    const id = store.entries[0]!.id
    expect(store.update(id, { ...draft, movieTitle: '新名稱', seatLabel: '5-5' })).toBe(true)
    expect(store.entries).toHaveLength(1)
    expect(store.entries[0]?.id).toBe(id)
    expect(store.entries[0]?.movieTitle).toBe('新名稱')
    expect(store.update('unknown', draft)).toBe(false)
    expect(store.remove(id)).toBe(true)
    expect(store.entries).toHaveLength(0)
    expect(JSON.parse(window.localStorage.getItem(WATCH_HISTORY_STORAGE_KEY)!).entries).toEqual([])
  })

  it('rejects invalid title/date, and never silently saves if local storage is blocked', () => {
    const store = useManualWatchHistoryStore()
    expect(store.add({ ...draft, movieTitle: '   ' })).toBe(false)
    expect(store.add({ ...draft, watchedOn: '2026-02-30' })).toBe(false)
    expect(store.entries).toHaveLength(0)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })
    expect(store.add(draft)).toBe(false)
    expect(store.entries).toHaveLength(0)
    expect(store.storageFailure).toBe('unavailable')
  })

  it('does not overwrite unreadable stored data', () => {
    window.localStorage.setItem(WATCH_HISTORY_STORAGE_KEY, '{corrupted}')
    const store = useManualWatchHistoryStore()
    expect(store.storageFailure).toBe('invalid')
    expect(store.add(draft)).toBe(false)
    expect(window.localStorage.getItem(WATCH_HISTORY_STORAGE_KEY)).toBe('{corrupted}')
  })
})
