/**
 * Publish a *research-only* list of observed public screening hall labels for
 * the 15 Showtime venues. The list is a safety allowlist, NOT a claim about
 * all halls or physical capacity. Always verify the actual event-card venue.
 */
import assert from 'node:assert/strict'
import console from 'node:console'
import fs from 'node:fs'
import path from 'node:path'
import { URL, fileURLToPath } from 'node:url'

const repo = fileURLToPath(new URL('../', import.meta.url))
const dir = path.join(repo, 'docs/research/theatgood-2026-11-18')
const files = fs
  .readdirSync(dir)
  .filter(
    (name) =>
      name.startsWith('showtime_public_hall_census_showtime-') && name.endsWith('_2026-11-18.json'),
  )
const venues = {}
for (const file of files) {
  const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'))
  assert(data.cinemaSlug.startsWith('showtime-'))
  assert(Array.isArray(data.publicHallLabels) && data.publicHallLabels.length > 0)
  assert(!venues[data.cinemaSlug], 'Duplicate venue census')
  venues[data.cinemaSlug] = [...new Set(data.publicHallLabels)].sort()
}
assert.equal(Object.keys(venues).length, 15)
assert.deepEqual(venues['showtime-taitung'], [
  '1廳',
  '2廳',
  '3廳',
  '4廳',
  '5廳',
  '6廳',
  '7廳',
  '8廳',
])
const output = {
  source: 'operator_public_session_hall_name_census_2026-11-18',
  scope: 'venue_hall_names_observed_on_sampled_screenings_only',
  caveat:
    'Hall names alone do NOT prove a screening belongs to the venue. Requires exact venue+hall on the individual event card. Names not observed in the sample may still be legitimate but cannot be attributed automatically.',
  venues,
}
const outputPath = path.join(
  repo,
  'scripts/showtime-chrome-extension/operator-public-hall-census.json',
)
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n', 'utf8')
console.log(
  JSON.stringify({
    venues: Object.keys(venues).length,
    taitungHallLabels: venues['showtime-taitung'],
    output: outputPath,
  }),
)
