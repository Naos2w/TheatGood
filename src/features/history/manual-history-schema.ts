import { z } from 'zod'

/**
 * Shared, transport-safe history contract. Do not import viewer, Vue or
 * Vite-only modules here: both the browser and a future authenticated
 * server need to parse exactly the same private record format.
 */
export const manualWatchDraftSchema = z.object({
  movieTitle: z.string().trim().min(1).max(250),
  watchedOn: z.iso.date(),
  cinemaSlug: z.string().max(120).nullable(),
  cinemaName: z.string().trim().min(1).max(200),
  hallName: z.string().trim().max(160),
  seatLabel: z.string().trim().max(20),
  modelId: z.string().max(120).nullable(),
  modelVersion: z.number().int().positive().nullable(),
  manualEntry: z.literal(true),
  screeningId: z.null(),
})

export const manualWatchEntrySchema = manualWatchDraftSchema.extend({
  id: z.string().uuid(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

export type ManualWatchDraft = z.infer<typeof manualWatchDraftSchema>
export type ManualWatchEntry = z.infer<typeof manualWatchEntrySchema>
