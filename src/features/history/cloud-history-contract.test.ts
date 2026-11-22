import { describe, expect, it } from 'vitest'
import { planInitialCloudHistoryImport, type CloudHistoryRecord } from './cloud-history-contract'
import type { ManualWatchEntry } from './manual-history'

const first: ManualWatchEntry = {
  id: '7112d1c3-55d9-4cf4-9fa2-000000000010',
  movieTitle: '自由輸入的觀影名稱',
  watchedOn: '2026-11-16',
  cinemaSlug: 'spot-taipei',
  cinemaName: '光點台北電影館',
  hallName: '光點電影院',
  seatLabel: '1-1',
  modelId: 'spot-taipei',
  modelVersion: 1,
  manualEntry: true,
  screeningId: null,
  createdAt: '2026-11-17T02:00:00.000Z',
  updatedAt: '2026-11-18T02:00:00.000Z',
}
const second: ManualWatchEntry = {
  ...first,
  id: '7112d1c3-55d9-4cf4-9fa2-000000000011',
  movieTitle: '另一次觀影',
  modelId: null,
  modelVersion: null,
  seatLabel: 'H12',
}

const owned = (ownerId: string, entry: ManualWatchEntry): CloudHistoryRecord => ({
  ownerId,
  entry,
})

describe('opt-in, fail-closed first cloud history import', () => {
  it('does nothing without a verified session identity and explicit migration consent', () => {
    const unauthenticated = planInitialCloudHistoryImport({
      authenticatedOwnerId: null,
      userConfirmed: true,
      localEntries: [first],
      remoteRecords: [],
    })
    expect(unauthenticated.status).toBe('unauthenticated')
    expect(unauthenticated.uploads).toEqual([])
    const unconfirmed = planInitialCloudHistoryImport({
      authenticatedOwnerId: 'verified-user-a',
      userConfirmed: false,
      localEntries: [first],
      remoteRecords: [],
    })
    expect(unconfirmed.status).toBe('consent-required')
    expect(unconfirmed.uploads).toEqual([])
  })

  it('only plans missing local records without rewriting or deleting remote-only records', () => {
    const plan = planInitialCloudHistoryImport({
      authenticatedOwnerId: 'verified-user-a',
      userConfirmed: true,
      localEntries: [first, second],
      remoteRecords: [owned('verified-user-a', first)],
    })
    expect(plan.status).toBe('ready')
    if (plan.status !== 'ready') return
    expect(plan.uploads).toEqual([second])
    expect(plan.unchanged).toEqual([first.id])
    expect(plan.conflicts).toEqual([])
    expect(plan.remoteOnly).toEqual([])

    const onlyRemote = planInitialCloudHistoryImport({
      authenticatedOwnerId: 'verified-user-a',
      userConfirmed: true,
      localEntries: [first],
      remoteRecords: [owned('verified-user-a', first), owned('verified-user-a', second)],
    })
    expect(onlyRemote.remoteOnly).toEqual([second.id])
    expect(onlyRemote.uploads).toEqual([])
  })

  it('never overwrites two different records bearing the same UUID even if local timestamp is newer', () => {
    const divergent = {
      ...first,
      movieTitle: '遠端使用者曾經編輯',
      updatedAt: '2026-11-15T02:00:00.000Z',
    }
    const plan = planInitialCloudHistoryImport({
      authenticatedOwnerId: 'verified-user-a',
      userConfirmed: true,
      localEntries: [first],
      remoteRecords: [owned('verified-user-a', divergent)],
    })
    expect(plan.uploads).toEqual([])
    expect(plan.conflicts).toEqual([{ id: first.id, local: first, remote: divergent }])
  })

  it('refuses foreign-owner rows, corrupt records, and repeated entry IDs without modifying either side', () => {
    const make = (localEntries: unknown, remoteRecords: unknown) =>
      planInitialCloudHistoryImport({
        authenticatedOwnerId: 'verified-user-a',
        userConfirmed: true,
        localEntries,
        remoteRecords,
      })
    expect(() => make([first], [owned('verified-user-b', first)])).toThrow(/ownership mismatch/)
    expect(() => make([first, first], [])).toThrow(/Duplicate/)
    expect(() =>
      make([first], [owned('verified-user-a', first), owned('verified-user-a', first)]),
    ).toThrow(/Duplicate/)
    expect(() => make([{ ...first, watchedOn: '2026-02-30' }], [])).toThrow()
    expect(() =>
      make([first], [{ ownerId: 'verified-user-a', entry: { ...second, id: 'not-uuid' } }]),
    ).toThrow()
  })
})
