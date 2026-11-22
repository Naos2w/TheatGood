/**
 * Extract historical, PUBLIC operator-PUBLISHED hall seat COUNTS only.
 * Never interpret a capacity image or table as a seat map.
 * Raw research stays private/untracked; only sanitised old counts are published.
 */
import assert from 'node:assert/strict'
import console from 'node:console'
import fs from 'node:fs'
import path from 'node:path'
import { URL, fileURLToPath } from 'node:url'

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const research = path.join(root, 'docs/research/theatgood-2026-11-18')
const additions = JSON.parse(
  fs.readFileSync(
    path.join(root, 'src/features/cinemas/data/additional-chain-branches-2026-11-18.json'),
    'utf8',
  ),
)
const approved = new Set(additions.records.map((r) => r.slug))
assert.equal(additions.records.length, 26)
const sources = [
  {
    brand: 'ambassador',
    file: 'ambassador_official_hall_capacity_2026-11-18.json',
    count: (row) => row.published_total_seats,
    url: (row) => row.source_url,
    observed: (row) => row.seat_row_and_number_grid_verified,
    level: 'official_direct_capacity',
  },
  {
    brand: 'in89',
    file: 'in89_official_image_hall_capacity_2026-11-18.json',
    count: (row) => row.published_total_seats,
    url: (row) => row.operator_page_url,
    observed: (row) => row.seat_row_and_number_grid_verified,
    level: 'official_static_capacity_image_transcribed_by_human',
  },
  {
    brand: 'broadway',
    file: 'broadway_official_hall_capacity_2026-11-18.json',
    count: (row) => row.published_seat_count,
    url: (row) => row.source_url,
    observed: (row) => row.seat_number_grid_verified,
    level: 'official_direct_published_capacity',
  },
  {
    brand: 'centuryasia',
    file: 'centuryasia_official_hall_capacity_2026-11-18.json',
    count: (row) => row.published_total_positions,
    url: (row) => row.source_url,
    observed: (row) => row.seat_labels_and_aisles_verified,
    level: 'official_direct_published_capacity',
  },
]
const domains = new Set([
  'www.ambassador.com.tw',
  'www.in89cinemax.com',
  'www.broadway-cineplex.com.tw',
  'www.centuryasia.com.tw',
])
const hallCounts = []
for (const spec of sources) {
  const archive = JSON.parse(fs.readFileSync(path.join(research, spec.file), 'utf8'))
  assert(Array.isArray(archive.records))
  for (const row of archive.records) {
    assert.equal(row.brand, spec.brand, 'Unexpected hall brand in archived source')
    assert(approved.has(row.branch_id), 'Unapproved or stale branch reference')
    assert.equal(row.source_level, spec.level)
    assert.equal(row.observed_date, '2026-11-18')
    assert.equal(spec.observed(row), false, 'Never publish a purported unverified row/seat grid')
    assert(typeof row.hall_label === 'string' && row.hall_label.trim().length > 0)
    assert(row.hall_label.length <= 60)
    const seats = spec.count(row)
    assert(Number.isInteger(seats) && seats > 0 && seats <= 2500)
    const url = new URL(spec.url(row))
    assert.equal(url.protocol, 'https:')
    assert(domains.has(url.hostname))
    hallCounts.push({
      brand: row.brand,
      cinemaSlug: row.branch_id,
      hallLabel: row.hall_label,
      publishedSeatCount: seats,
      publishedAt: '2026-11-18',
      sourceUrl: url.toString(),
      sourceLevel: row.source_level,
      seatGridVerified: false,
      sourceCaveat:
        spec.brand === 'in89'
          ? 'historical-operator-capacity-image-current-seat-configuration-unverified'
          : 'published-capacity-only-current-seat-configuration-unverified',
      capacityIncludesAccessible:
        spec.brand === 'centuryasia' ? 'published-total-positions' : 'unconfirmed',
    })
  }
}
const expected = { ambassador: 81, broadway: 25, centuryasia: 62, in89: 54 }
for (const [brand, count] of Object.entries(expected)) {
  assert.equal(hallCounts.filter((item) => item.brand === brand).length, count)
}
const ids = hallCounts.map((row) => row.cinemaSlug + '|' + row.hallLabel)
assert.equal(
  new Set(ids).size,
  hallCounts.length,
  'Do not publish two seat capacities for one hall',
)
hallCounts.sort(
  (a, b) =>
    a.brand.localeCompare(b.brand) ||
    a.cinemaSlug.localeCompare(b.cinemaSlug) ||
    a.hallLabel.localeCompare(b.hallLabel, 'zh-TW', { numeric: true }),
)
const output = {
  observedDate: '2026-11-18',
  sourceLevel: 'historical-public-operator-capacity-only',
  checkedRealtimeNow: false,
  physicalSeatGridVerified: false,
  publishedSeatCountRecords: hallCounts.length,
  records: hallCounts,
}
const target = path.join(
  root,
  'src/features/cinemas/data/additional-chain-published-seats-2026-11-18.json',
)
fs.writeFileSync(target, JSON.stringify(output, null, 2) + '\n', 'utf8')
console.log(
  JSON.stringify({
    count: output.records.length,
    brands: expected,
    coveredBranches: new Set(hallCounts.map((row) => row.cinemaSlug)).size,
    checkedRealtimeNow: false,
    privateSeatGridPublished: false,
    target,
  }),
)
