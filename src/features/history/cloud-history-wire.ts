import { z } from 'zod'
import { manualWatchEntrySchema, type ManualWatchEntry } from './manual-history-schema'

/** Public REST data shape only; user_id is deliberately never accepted on writes. */
const wireRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().min(1),
  movie_title: z.string(),
  watched_on: z.iso.date(),
  cinema_slug: z.string().nullable(),
  cinema_name: z.string(),
  auditorium_name: z.string().nullable(),
  seat_label: z.string().nullable(),
  local_model_id: z.string().nullable(),
  local_model_version: z.number().int().positive().nullable(),
  manual_entry: z.literal(true),
  screening_id: z.null(),
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
})

export function decodePrivateWatchLog(input: unknown, expectedOwner: string): ManualWatchEntry {
  const row = wireRowSchema.parse(input)
  if (row.user_id !== expectedOwner) throw new Error('Private history owner mismatch')
  return manualWatchEntrySchema.parse({
    id: row.id,
    movieTitle: row.movie_title,
    watchedOn: row.watched_on,
    cinemaSlug: row.cinema_slug,
    cinemaName: row.cinema_name,
    hallName: row.auditorium_name ?? '',
    seatLabel: row.seat_label ?? '',
    modelId: row.local_model_id,
    modelVersion: row.local_model_version,
    manualEntry: true,
    screeningId: null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  })
}

/** The DEFAULT on watch_logs.user_id must derive the owner from auth.user_id(). */
export function encodePrivateWatchLog(input: unknown) {
  const entry = manualWatchEntrySchema.parse(input)
  return {
    id: entry.id,
    movie_title: entry.movieTitle,
    watched_at: entry.watchedOn + 'T04:00:00.000Z',
    watched_on: entry.watchedOn,
    cinema_slug: entry.cinemaSlug,
    cinema_name: entry.cinemaName,
    auditorium_name: entry.hallName,
    seat_label: entry.seatLabel,
    local_model_id: entry.modelId,
    local_model_version: entry.modelVersion,
    manual_entry: true,
    screening_id: null,
    model_version_id: null,
    created_at: entry.createdAt,
    updated_at: entry.updatedAt,
  }
}
