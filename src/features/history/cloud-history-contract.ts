import { z } from 'zod'
import { manualWatchEntrySchema, type ManualWatchEntry } from './manual-history-schema'

const historyListSchema = z.array(manualWatchEntrySchema).max(2000)
const cloudRecordSchema = z.object({
  /** Only the authenticated server may set or trust this field. */
  ownerId: z.string().min(1).max(255),
  entry: manualWatchEntrySchema,
})
const cloudRecordListSchema = z.array(cloudRecordSchema).max(2000)

export type CloudHistoryRecord = z.infer<typeof cloudRecordSchema>
export type HistoryImportConflict = {
  id: string
  local: ManualWatchEntry
  remote: ManualWatchEntry
}

export type HistoryImportPlan =
  | {
      status: 'unauthenticated' | 'consent-required'
      uploads: []
      conflicts: []
      unchanged: []
      remoteOnly: []
    }
  | {
      status: 'ready'
      uploads: ManualWatchEntry[]
      conflicts: HistoryImportConflict[]
      unchanged: string[]
      remoteOnly: string[]
    }

/**
 * Pure, no-side-effects first-import planner. It never contacts Neon, creates an
 * endpoint, migrates local storage, deletes a remote entry, or overwrites conflicts.
 *
 * Security precondition for a FUTURE server caller: authenticatedOwnerId MUST
 * come from a verified server-side session, never from a request body or cookie
 * value without signature validation. No Auth integration is present yet.
 */
export function planInitialCloudHistoryImport(input: {
  authenticatedOwnerId: string | null
  userConfirmed: boolean
  localEntries: unknown
  remoteRecords: unknown
}): HistoryImportPlan {
  if (!input.authenticatedOwnerId?.trim()) {
    return { status: 'unauthenticated', uploads: [], conflicts: [], unchanged: [], remoteOnly: [] }
  }
  if (!input.userConfirmed) {
    return { status: 'consent-required', uploads: [], conflicts: [], unchanged: [], remoteOnly: [] }
  }

  // Any corrupt or foreign record aborts the whole dry-run instead of silently
  // dropping it, overwriting data, or mixing users' private viewing histories.
  const local = historyListSchema.parse(input.localEntries)
  const remote = cloudRecordListSchema.parse(input.remoteRecords)
  if (remote.some((record) => record.ownerId !== input.authenticatedOwnerId)) {
    throw new Error('Cloud watch history ownership mismatch')
  }
  const unique = <T>(records: readonly T[], idFor: (value: T) => string): void => {
    const ids = new Set(records.map(idFor))
    if (ids.size !== records.length) throw new Error('Duplicate watch history entry ID')
  }
  unique(local, (entry) => entry.id)
  unique(remote, (record) => record.entry.id)

  const remoteById = new Map(remote.map((record) => [record.entry.id, record.entry]))
  const localIds = new Set(local.map((entry) => entry.id))
  const uploads: ManualWatchEntry[] = []
  const conflicts: HistoryImportConflict[] = []
  const unchanged: string[] = []

  for (const entry of local) {
    const other = remoteById.get(entry.id)
    if (!other) {
      uploads.push(entry)
    } else if (JSON.stringify(entry) === JSON.stringify(other)) {
      unchanged.push(entry.id)
    } else {
      // Never use updatedAt to auto-decide who wins; clocks may be incorrect,
      // and hard deletions do not have tombstones in the current local MVP.
      conflicts.push({ id: entry.id, local: entry, remote: other })
    }
  }
  return {
    status: 'ready',
    uploads,
    conflicts,
    unchanged,
    remoteOnly: remote
      .filter((record) => !localIds.has(record.entry.id))
      .map((record) => record.entry.id),
  }
}
