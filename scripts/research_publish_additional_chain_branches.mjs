/**
 * Publish ONLY historically observed, public chain-venue metadata from the
 * offline 2026-11-18 research census. Never publish private Showtime seat grids,
 * ticketing pages, identities, credentials, opening statuses or hallucinated halls.
 */
import assert from 'node:assert/strict'
import console from 'node:console'
import fs from 'node:fs'
import path from 'node:path'
import { URL, fileURLToPath } from 'node:url'

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const source = path.join(
  root,
  'docs/research/theatgood-2026-11-18/all_chain_branches_inventory_2026-11-18.json',
)
const target = path.join(
  root,
  'src/features/cinemas/data/additional-chain-branches-2026-11-18.json',
)
const brands = new Set(['ambassador', 'broadway', 'centuryasia', 'in89', 'skcinemas'])
const verifiedDomains = new Set([
  'shinefilm.ambassador.com.tw',
  'www.broadway-cineplex.com.tw',
  'www.centuryasia.com.tw',
  'ksml.centuryasia.com.tw',
  'ximen.centuryasia.com.tw',
  'beyond.centuryasia.com.tw',
  'www.in89cinemax.com',
  'www.skcinemas.com',
  'page.line.me',
])
const evidenceLevels = new Set([
  'official_direct',
  'official_rendered_branch_page',
  'operator_owned_line',
])
const census = JSON.parse(fs.readFileSync(source, 'utf8'))
assert.equal(census.checked_at, '2026-11-18')
assert.equal(census.not_realtime_opening_confirmation, true)
assert.equal(census.additions, 26)
const selected = census.records.filter((record) => record.in_current_app === false)
assert.equal(selected.length, 26, 'Unexpected number of missing historical branch listings')
const output = selected
  .map((record) => {
    assert(brands.has(record.brand), 'Unexpected chain brand in historical research')
    assert(/^[a-z0-9-]+$/.test(record.branch_id))
    assert(record.branch_id.startsWith(record.brand + '-'))
    assert(typeof record.name === 'string' && record.name.length >= 3)
    assert(typeof record.city === 'string' && record.city.length >= 2)
    assert(typeof record.address === 'string' && record.address.startsWith(record.city))
    assert(evidenceLevels.has(record.address_evidence_level))
    assert.equal(record.venue_listing_status, 'operator_directory_listed_not_open_now_verified')
    assert.equal(record.numbered_seating_positions_status, 'not_confirmed')
    const sourceUrl = new URL(record.address_source_url)
    const directoryUrl = new URL(record.brand_directory_url)
    assert.equal(sourceUrl.protocol, 'https:')
    assert.equal(directoryUrl.protocol, 'https:')
    assert(verifiedDomains.has(sourceUrl.hostname))
    assert(verifiedDomains.has(directoryUrl.hostname))
    return {
      brand: record.brand,
      slug: record.branch_id,
      name: record.name,
      city: record.city,
      address: record.address,
      sourceUrl: record.address_source_url,
      directoryUrl: record.brand_directory_url,
      checkedAt: '2026-11-18',
      listingEvidence: record.address_evidence_level,
      operatingNowVerified: false,
      observedSeatGridVerified: false,
    }
  })
  .sort((a, b) => a.brand.localeCompare(b.brand) || a.slug.localeCompare(b.slug))
assert.equal(new Set(output.map((entry) => entry.slug)).size, output.length)
assert.deepEqual(
  Object.fromEntries(
    [...brands]
      .sort()
      .map((brand) => [brand, output.filter((entry) => entry.brand === brand).length]),
  ),
  { ambassador: 9, broadway: 2, centuryasia: 4, in89: 6, skcinemas: 5 },
)
const result = {
  sourceDate: '2026-11-18',
  provenance: 'archived-official-branch-research-not-realtime-opening-confirmation',
  purpose: 'venue-discovery-and-future-seat-source-worklist-only',
  sourceGridCaptured: false,
  records: output,
}
fs.writeFileSync(target, JSON.stringify(result, null, 2) + '\n', 'utf8')
console.log(
  JSON.stringify({
    records: output.length,
    categories: [...brands].sort(),
    noRealtimeOpeningClaims: output.every((item) => !item.operatingNowVerified),
    noSourceSeatGrids: output.every((item) => !item.observedSeatGridVerified),
    target,
  }),
)
