import { defineStore } from 'pinia'
import { ref } from 'vue'
import { z } from 'zod'
import {
  manualWatchDraftSchema,
  manualWatchEntrySchema,
  type ManualWatchDraft,
  type ManualWatchEntry,
} from '../features/history/manual-history'

export const WATCH_HISTORY_STORAGE_KEY = 'theatgood-manual-watch-history-v1'
const historyEnvelope = z.object({
  version: z.literal(1),
  entries: z.array(manualWatchEntrySchema).max(2000),
})
type StorageFailure = 'unavailable' | 'invalid' | null

function readLocalHistory(): { entries: ManualWatchEntry[]; failure: StorageFailure } {
  if (typeof window === 'undefined') return { entries: [], failure: 'unavailable' }
  let data: string | null
  try {
    data = window.localStorage.getItem(WATCH_HISTORY_STORAGE_KEY)
  } catch {
    return { entries: [], failure: 'unavailable' }
  }
  if (!data) return { entries: [], failure: null }
  try {
    const parsed = historyEnvelope.safeParse(JSON.parse(data))
    if (!parsed.success) return { entries: [], failure: 'invalid' }
    return { entries: parsed.data.entries, failure: null }
  } catch {
    // Malformed existing data must not be silently replaced by a new record.
    return { entries: [], failure: 'invalid' }
  }
}

export const useManualWatchHistoryStore = defineStore('manual-watch-history', () => {
  const initial = readLocalHistory()
  const entries = ref<ManualWatchEntry[]>(initial.entries)
  const storageFailure = ref<StorageFailure>(initial.failure)

  function persist(next: ManualWatchEntry[]): boolean {
    if (storageFailure.value === 'invalid') return false
    if (typeof window === 'undefined') {
      storageFailure.value = 'unavailable'
      return false
    }
    try {
      // Commit UI state only after the browser confirms durable storage.
      window.localStorage.setItem(
        WATCH_HISTORY_STORAGE_KEY,
        JSON.stringify({ version: 1, entries: next }),
      )
      entries.value = next
      storageFailure.value = null
      return true
    } catch {
      storageFailure.value = 'unavailable'
      return false
    }
  }

  function add(draft: ManualWatchDraft): boolean {
    const valid = manualWatchDraftSchema.safeParse(draft)
    if (!valid.success || entries.value.length >= 2000 || !globalThis.crypto?.randomUUID) {
      return false
    }
    const now = new Date().toISOString()
    const entry: ManualWatchEntry = {
      ...valid.data,
      id: globalThis.crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    }
    return persist([entry, ...entries.value])
  }

  function update(id: string, draft: ManualWatchDraft): boolean {
    const parsed = manualWatchDraftSchema.safeParse(draft)
    if (!parsed.success || !entries.value.some((entry) => entry.id === id)) return false
    return persist(
      entries.value.map((entry) =>
        entry.id === id ? { ...entry, ...parsed.data, updatedAt: new Date().toISOString() } : entry,
      ),
    )
  }

  function remove(id: string): boolean {
    if (!entries.value.some((entry) => entry.id === id)) return false
    return persist(entries.value.filter((entry) => entry.id !== id))
  }

  function syncFromBrowser(event: StorageEvent): void {
    if (event.key !== WATCH_HISTORY_STORAGE_KEY) return
    const next = readLocalHistory()
    entries.value = next.entries
    storageFailure.value = next.failure
  }

  if (typeof window !== 'undefined') window.addEventListener('storage', syncFromBrowser)

  return { entries, storageFailure, add, update, remove }
})
