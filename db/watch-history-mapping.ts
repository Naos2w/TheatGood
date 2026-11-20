import {
  manualWatchEntrySchema,
  type ManualWatchEntry,
} from '../src/features/history/manual-history-schema'
import { watchLogs } from './schema'

/**
 * Database adapter only: this deliberately omits userId, which MUST be
 * assigned by an authenticated server after verifying the session subject.
 * There is no public write API yet.
 */
export function toCloudWatchLogRow(input: unknown): Omit<typeof watchLogs.$inferInsert, 'userId'> {
  const entry = manualWatchEntrySchema.parse(input)
  return {
    id: entry.id,
    // Legacy watched_at is required by the existing table. The user's real
    // information is the date-only watched_on; noon Taipei is a neutral anchor,
    // NOT a claim about a film's screening time.
    watchedAt: new Date(entry.watchedOn + 'T04:00:00.000Z'),
    watchedOn: entry.watchedOn,
    seatLabel: entry.seatLabel,
    movieTitle: entry.movieTitle,
    cinemaName: entry.cinemaName,
    cinemaSlug: entry.cinemaSlug,
    auditoriumName: entry.hallName,
    localModelId: entry.modelId,
    localModelVersion: entry.modelVersion,
    manualEntry: true,
    screeningId: null,
    modelVersionId: null,
    createdAt: new Date(entry.createdAt),
    updatedAt: new Date(entry.updatedAt),
  }
}

/** Only a completely migrated manual record can round-trip back to the UI. */
export function fromCloudWatchLogRow(
  row: Pick<
    typeof watchLogs.$inferSelect,
    | 'id'
    | 'watchedOn'
    | 'movieTitle'
    | 'cinemaName'
    | 'cinemaSlug'
    | 'auditoriumName'
    | 'seatLabel'
    | 'localModelId'
    | 'localModelVersion'
    | 'manualEntry'
    | 'screeningId'
    | 'createdAt'
    | 'updatedAt'
  >,
): ManualWatchEntry {
  if (
    !row.watchedOn ||
    !row.cinemaName ||
    !row.manualEntry ||
    row.screeningId !== null ||
    !row.updatedAt
  ) {
    // Existing legacy watch logs cannot safely fabricate missing local fields.
    throw new Error('Legacy or non-manual record cannot be restored as a local watch entry')
  }
  return manualWatchEntrySchema.parse({
    id: row.id,
    movieTitle: row.movieTitle,
    watchedOn: row.watchedOn,
    cinemaSlug: row.cinemaSlug,
    cinemaName: row.cinemaName,
    hallName: row.auditoriumName ?? '',
    seatLabel: row.seatLabel ?? '',
    modelId: row.localModelId,
    modelVersion: row.localModelVersion,
    manualEntry: true,
    screeningId: null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  })
}
