import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { createHash } from 'node:crypto'
import originalHsinyi from '../src/features/cinemas/data/vieshow-hsinyi-public-seat-layouts-2026-11-16.json'
import { publishedVieshowHalls } from '../src/features/cinemas/vieshow-halls'
import { chainCinemas } from '../src/features/cinemas/chain-directory'

type Seat = [label: string, row: number, col: number]
type Wheelchair = [row: number, col: number]
type Observed = {
  cinemaSlug: string
  cinemaCode: number
  physicalHallNumber: number | null
  physicalHallLabel: string
  seatPositions: Seat[]
  wheelchairPositions: Wheelchair[]
  gridRows: number
  gridColumns: number
  sourceUrl: string
  checkedAt: string
}
type Item = {
  id: string
  hallLabel: string
  hallNumber: number | null
  cinemaCode: number
  snapshotSource: string
  observedAt: string
  publishedSeatCount: number | null
  countComparison: 'exact' | 'wheelchair-markers-match' | 'different' | 'not-published'
  ordinarySeatCount: number
  wheelchairMarkers: number
  gridRows: number
  gridColumns: number
  seatPositions: Seat[]
  wheelchairPositions: Wheelchair[]
}
type VenueFile = {
  schemaVersion: number
  venueSlug: string
  observedAt: string
  sourceType: string
  caveat: string
  layouts: Item[]
}

const root = process.cwd()
const inputDir = resolve(root, 'src/features/cinemas/data')
const outputDir = join(inputDir, 'vieshow-snapshots-2026-11-16')
const venueList = chainCinemas.filter((v) => v.brand === 'vieshow')
const official = new Map(
  publishedVieshowHalls.map((x) => [x.cinemaSlug + '|' + x.hallNumber, x.publishedSeatCount]),
)
const observed = new Map<string, Observed>()
const conflicts: { hall: string; sources: string[]; reason: string }[] = []
const issues: string[] = []
const countByVenue = new Map<string, { seen: number; duplicates: number }>()
const rawFiles = (await readdir(inputDir))
  .filter((f) => /^vieshow-collection-.*\.json$/.test(f))
  .sort()
const snapshotDate = '2026-11-16'
const viewSlug = (slug: string, label: string, num: number | null) =>
  slug +
  '|' +
  (num === null
    ? label
        .replace(/^第/, '')
        .replace(/廳$/, '')
        .replace(/\s+/g, '')
        .toUpperCase()
        .replace(/GC0+(\d+)/, 'GC$1')
    : num)
const snapshotHash = (item: Observed) =>
  createHash('sha256')
    .update(
      JSON.stringify([...item.seatPositions].sort((a, b) => a[0].localeCompare(b[0]))) +
        '|' +
        JSON.stringify([...item.wheelchairPositions].sort((a, b) => a[0] - b[0] || a[1] - b[1])),
    )
    .digest('hex')
function verify(item: Observed): string | null {
  if (!venueList.some((v) => v.slug === item.cinemaSlug)) return 'unknown venue'
  const url = new URL(item.sourceUrl)
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'sales.vscinemas.com.tw' ||
    url.pathname !== '/VoucherTicketing/SessionSeats.aspx' ||
    !url.searchParams.has('txtSessionId') ||
    Number(url.searchParams.get('CinemaCode')) !== item.cinemaCode
  )
    return 'incorrect source domain or session'
  if (item.physicalHallNumber === null && !item.physicalHallLabel) return 'missing hall label'
  if (
    !Number.isInteger(item.gridRows) ||
    item.gridRows <= 0 ||
    item.gridRows > 150 ||
    !Number.isInteger(item.gridColumns) ||
    item.gridColumns <= 0 ||
    item.gridColumns > 150
  )
    return 'invalid grid dimensions'
  if (!item.seatPositions.length) return 'no observed seats'
  const labels = new Set<string>(),
    positions = new Set<string>()
  for (const [label, row, col] of item.seatPositions) {
    const key = row + ':' + col
    if (
      !/^(?=.*\d)[A-Z0-9-]{2,9}$/i.test(label) ||
      !Number.isInteger(row) ||
      !Number.isInteger(col) ||
      row < 1 ||
      row > item.gridRows ||
      col < 1 ||
      col > item.gridColumns ||
      labels.has(label) ||
      positions.has(key)
    )
      return 'invalid, overlapping or repeated seat'
    labels.add(label)
    positions.add(key)
  }
  for (const [row, col] of item.wheelchairPositions) {
    const key = row + ':' + col
    if (
      !Number.isInteger(row) ||
      !Number.isInteger(col) ||
      row < 1 ||
      row > item.gridRows ||
      col < 1 ||
      col > item.gridColumns ||
      positions.has(key)
    )
      return 'wheelchair position overlaps or outside grid'
    positions.add(key)
  }
  return null
}
function insert(item: Observed, filename: string) {
  const err = verify(item)
  if (err) {
    issues.push(
      filename +
        ': ' +
        viewSlug(item.cinemaSlug, item.physicalHallLabel, item.physicalHallNumber) +
        ' ' +
        err,
    )
    return
  }
  const key = viewSlug(item.cinemaSlug, item.physicalHallLabel, item.physicalHallNumber)
  const stats = countByVenue.get(item.cinemaSlug) || { seen: 0, duplicates: 0 }
  stats.seen++
  countByVenue.set(item.cinemaSlug, stats)
  const existing = observed.get(key)
  if (existing) {
    stats.duplicates++
    if (snapshotHash(existing) !== snapshotHash(item)) {
      conflicts.push({
        hall: key,
        sources: [existing.sourceUrl, item.sourceUrl],
        reason: 'Different seat coordinates or wheelchair locations in same hall snapshot date',
      })
      // The first well-attributed snapshot is retained, and the conflicting second
      // source must be manually reconciled rather than silently overwriting.
    }
    return
  }
  observed.set(key, item)
}
for (const f of rawFiles) {
  const raw = JSON.parse(await readFile(join(inputDir, f), 'utf8'))
  for (const h of raw.found || [])
    insert(
      {
        cinemaSlug: h.cinemaSlug,
        cinemaCode: h.cinemaCode,
        physicalHallNumber: h.physicalHallNumber ?? null,
        physicalHallLabel: h.physicalHallLabel,
        seatPositions: h.seatPositions,
        wheelchairPositions: h.wheelchairPositions,
        gridRows: h.gridRows,
        gridColumns: h.gridColumns,
        sourceUrl: h.sourceUrl,
        checkedAt: h.checkedAt,
      },
      f,
    )
}
for (const h of originalHsinyi.layouts) {
  insert(
    {
      cinemaSlug: h.cinemaSlug,
      cinemaCode: 1,
      physicalHallNumber: h.physicalHallNumber,
      physicalHallLabel: '第' + h.physicalHallNumber + '廳',
      seatPositions: h.seatPositions as Seat[],
      wheelchairPositions: h.wheelchairPositions as Wheelchair[],
      gridRows: h.gridRows,
      gridColumns: h.gridColumns,
      sourceUrl: h.snapshotSource,
      checkedAt: originalHsinyi.checkedAt,
    },
    'PR #29: signed-off Hsin Yi source',
  )
}
if (issues.length) throw new Error('Invalid source facts detected:\n' + issues.join('\n'))
const summaries: {
  venueSlug: string
  venueName: string
  publishedHalls: number
  matchedPublishedHalls: number
  missingOfficialHalls: number[]
  observedLabels: number
  nonNumericHalls: string[]
  layoutFacts: {
    hallNumber: number | null
    hallLabel: string
    countComparison: Item['countComparison']
    ordinarySeatCount: number
    publishedSeatCount: number | null
  }[]
  exact: number
  wheelchairCountMatch: number
  differing: number
  unknown: number
  duplicateObservations: number
  conflictingObservations: number
}[] = []
await mkdir(outputDir, { recursive: true })
for (const venue of venueList) {
  const rawForVenue = [...observed.values()].filter((x) => x.cinemaSlug === venue.slug)
  const layouts: Item[] = rawForVenue
    .map((raw) => {
      const published =
        raw.physicalHallNumber === null
          ? null
          : (official.get(raw.cinemaSlug + '|' + raw.physicalHallNumber) ?? null)
      const regular = raw.seatPositions.length,
        wheels = raw.wheelchairPositions.length
      const countComparison =
        published === null
          ? 'not-published'
          : regular === published
            ? 'exact'
            : regular + wheels === published
              ? 'wheelchair-markers-match'
              : 'different'
      return {
        id:
          venue.slug +
          '-' +
          (raw.physicalHallNumber ?? raw.physicalHallLabel.replace(/[\s第廳]/g, '').toLowerCase()),
        hallLabel: raw.physicalHallLabel,
        hallNumber: raw.physicalHallNumber,
        cinemaCode: raw.cinemaCode,
        snapshotSource: raw.sourceUrl,
        observedAt: raw.checkedAt,
        publishedSeatCount: published,
        countComparison,
        ordinarySeatCount: regular,
        wheelchairMarkers: wheels,
        gridRows: raw.gridRows,
        gridColumns: raw.gridColumns,
        seatPositions: raw.seatPositions,
        wheelchairPositions: raw.wheelchairPositions,
      }
    })
    .sort(
      (a, b) =>
        (a.hallNumber ?? 999) - (b.hallNumber ?? 999) ||
        a.hallLabel.localeCompare(b.hallLabel, 'en', { numeric: true }),
    )
  const target: VenueFile = {
    schemaVersion: 2,
    venueSlug: venue.slug,
    observedAt: snapshotDate,
    sourceType: 'Vie Show public SessionSeats.aspx, read-only',
    caveat:
      'Reference-only numbered seats and grid cells. Wheelchair markers are separate. No ticket state, sales, or measured spatial geometry. Session URLs can expire and published count may include wheelchair positions.',
    layouts,
  }
  await writeFile(join(outputDir, venue.slug + '.json'), JSON.stringify(target) + '\n', 'utf8')
  const publishedHalls = publishedVieshowHalls.filter((h) => h.cinemaSlug === venue.slug)
  const seenNumbers = new Set(
    layouts.map((l) => l.hallNumber).filter((n): n is number => n !== null),
  )
  const missing = publishedHalls.map((h) => h.hallNumber).filter((h) => !seenNumbers.has(h))
  summaries.push({
    venueSlug: venue.slug,
    venueName: venue.name,
    publishedHalls: publishedHalls.length,
    matchedPublishedHalls: publishedHalls.length - missing.length,
    missingOfficialHalls: missing,
    observedLabels: layouts.length,
    nonNumericHalls: layouts.filter((l) => l.hallNumber === null).map((l) => l.hallLabel),
    layoutFacts: layouts.map((l) => ({
      hallNumber: l.hallNumber,
      hallLabel: l.hallLabel,
      countComparison: l.countComparison,
      ordinarySeatCount: l.ordinarySeatCount,
      publishedSeatCount: l.publishedSeatCount,
    })),
    exact: layouts.filter((l) => l.countComparison === 'exact').length,
    wheelchairCountMatch: layouts.filter((l) => l.countComparison === 'wheelchair-markers-match')
      .length,
    differing: layouts.filter((l) => l.countComparison === 'different').length,
    unknown: layouts.filter((l) => l.countComparison === 'not-published').length,
    duplicateObservations: countByVenue.get(venue.slug)?.duplicates ?? 0,
    conflictingObservations: conflicts.filter((c) => c.hall.startsWith(venue.slug + '|')).length,
  })
}
const manifest = {
  schemaVersion: 2,
  checkedAt: snapshotDate,
  source: 'Vie Show public seat preview + official May 2026 published capacity chart',
  totals: {
    venues: venueList.length,
    officialEntries: publishedVieshowHalls.length,
    matchedOfficialEntries: summaries.reduce((s, v) => s + v.matchedPublishedHalls, 0),
    missingOfficialEntries: summaries.reduce((s, v) => s + v.missingOfficialHalls.length, 0),
    layouts: summaries.reduce((s, v) => s + v.observedLabels, 0),
    exact: summaries.reduce((s, v) => s + v.exact, 0),
    wheelchairCountMatch: summaries.reduce((s, v) => s + v.wheelchairCountMatch, 0),
    differing: summaries.reduce((s, v) => s + v.differing, 0),
    unknown: summaries.reduce((s, v) => s + v.unknown, 0),
    conflictingObservations: conflicts.length,
  },
  venues: summaries,
}
await writeFile(
  join(inputDir, 'vieshow-coverage-2026-11-16.json'),
  JSON.stringify(manifest, null, 2) + '\n',
  'utf8',
)
await writeFile(
  join(inputDir, 'vieshow-snapshot-conflicts-2026-11-16.json'),
  JSON.stringify({ checkedAt: snapshotDate, conflicts }, null, 2) + '\n',
  'utf8',
)
console.log(
  JSON.stringify(
    {
      totals: manifest.totals,
      conflicts: conflicts.slice(0, 8),
      missing: summaries
        .filter((x) => x.missingOfficialHalls.length)
        .map((x) => ({ venue: x.venueSlug, missing: x.missingOfficialHalls })),
    },
    null,
    2,
  ),
)
