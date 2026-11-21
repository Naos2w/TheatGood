import { z } from 'zod'
import { chainCinemas } from '../cinemas/chain-directory'
import { parseShowtimeSeatSnapshot, type ShowtimeSeatSnapshot } from './showtime-estimated-scene'

const venue = z.string().regex(/^showtime-[a-z0-9-]+$/)
const hall = z.object({
  hallLabel: z.string().min(2).max(48),
  ordinarySeatCount: z.number().int().min(20).max(1000),
  rowsCount: z.number().int().min(1).max(150),
  observedAt: z.string().datetime({ offset: true }),
  researchedOnly: z.literal(true),
  physicallyMeasured: z.literal(false),
})
const indexSchema = z.object({
  researchOnly: z.literal(true),
  localDeviceOnly: z.literal(true),
  approvedForPublicUI: z.literal(false),
  sampledHallLabels: z.number().int().min(1),
  verifiedHallLabels: z.number().int().min(0),
  missingHallLabels: z.number().int().min(0),
  venues: z.record(venue, z.array(hall)),
})
export type ShowtimeLocalResearchIndex = z.infer<typeof indexSchema>
export type ShowtimeResearchHall = z.infer<typeof hall>

function requireKnownVenue(slug: string): void {
  if (
    !venue.safeParse(slug).success ||
    !chainCinemas.some((item) => item.brand === 'showtime' && item.slug === slug)
  ) {
    throw new Error('Unknown Showtime venue')
  }
}

async function localReadOnlyGet(path: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch('/__theatgood_private/showtime/' + path, {
    method: 'GET',
    cache: 'no-store',
    credentials: 'omit',
    signal,
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) {
    throw new Error(
      response.status === 403 ? 'Local-only preview denied' : 'Private research source unavailable',
    )
  }
  return response.json()
}

export async function loadLocalShowtimeResearchIndex(
  slug: string,
  signal?: AbortSignal,
): Promise<ShowtimeLocalResearchIndex> {
  requireKnownVenue(slug)
  const data = indexSchema.parse(await localReadOnlyGet('index', signal))
  if (!Object.hasOwn(data.venues, slug)) throw new Error('Local venue research missing')
  return data
}

/** Data is never stored in IndexedDB/localStorage, downloaded or imported into public builds. */
export async function loadLocalShowtimeResearchHall(
  slug: string,
  hallLabel: string,
  signal?: AbortSignal,
): Promise<ShowtimeSeatSnapshot> {
  requireKnownVenue(slug)
  if (!/^(?:[0-9]+館)?(?:[0-9]+|巨幕[0-9]+|丹普)廳$/.test(hallLabel)) {
    throw new Error('Invalid hall label')
  }
  const data = await localReadOnlyGet('hall/' + slug + '/' + encodeURIComponent(hallLabel), signal)
  const parsed = parseShowtimeSeatSnapshot(data, slug)
  if (
    parsed.evidence !== 'same-card-venue-and-hall' ||
    parsed.snapshot.observedHallLabel !== hallLabel
  ) {
    throw new Error('Hall source does not match requested venue')
  }
  return parsed.snapshot
}
