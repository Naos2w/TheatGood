import { describe, expect, it } from 'vitest'
import { decodePrivateWatchLog, encodePrivateWatchLog } from './cloud-history-wire'

const entry = {
  id: '7112d1c3-55d9-4cf4-9fa2-000000000010',
  movieTitle: '手動紀錄電影',
  watchedOn: '2026-11-20',
  cinemaSlug: 'spot-taipei',
  cinemaName: '光點台北電影館',
  hallName: '光點電影院',
  seatLabel: '1-1',
  modelId: 'spot-taipei',
  modelVersion: 1,
  manualEntry: true as const,
  screeningId: null,
  createdAt: '2026-11-20T04:00:00.000Z',
  updatedAt: '2026-11-20T04:15:00.000Z',
}

describe('Neon Data API private watch-history transport', () => {
  it('never accepts browser-supplied ownership and preserves every original field', () => {
    const encoded = encodePrivateWatchLog(entry)
    expect(encoded).not.toHaveProperty('user_id')
    expect(encoded.watched_on).toBe('2026-11-20')
    expect(encoded.watched_at).toBe('2026-11-20T04:00:00.000Z')
    expect(encoded.model_version_id).toBeNull()
    const restored = decodePrivateWatchLog(
      { ...encoded, user_id: 'verified-qa-a' },
      'verified-qa-a',
    )
    expect(restored).toEqual(entry)
  })

  it('rejects forged ownership, invalid dates and nonmanual legacy records', () => {
    const row = { ...encodePrivateWatchLog(entry), user_id: 'verified-qa-a' }
    expect(() => decodePrivateWatchLog(row, 'verified-qa-b')).toThrow(/owner mismatch/)
    expect(() => encodePrivateWatchLog({ ...entry, watchedOn: '2026-02-30' })).toThrow()
    expect(() => decodePrivateWatchLog({ ...row, watched_on: null }, 'verified-qa-a')).toThrow()
    expect(() => decodePrivateWatchLog({ ...row, manual_entry: false }, 'verified-qa-a')).toThrow()
  })
})
