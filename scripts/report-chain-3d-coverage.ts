/**
 * Source-accounting snapshot, NOT a census of real-world operating halls.
 * Run from the repository root:
 *   npx tsx scripts/report-chain-3d-coverage.ts
 * On the authorised MSI only, to include the local/private Showtime counts:
 *   npx tsx scripts/report-chain-3d-coverage.ts --private-root=<project-root>
 *
 * Never serialises seat positions, member details, URLs containing booking
 * sessions or individual seat labels. No file output unless --save is supplied.
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { chainCinemas } from '../src/features/cinemas/chain-directory'
import { pendingChainSeatSourceWorklist } from '../src/features/cinemas/chain-seat-evidence'
import vieShowManifest from '../src/features/cinemas/data/vieshow-coverage-2026-11-16.json'
import miranew from '../src/features/cinemas/data/miranew-observed-seats-2026-11-16.json'

const showtimeBranchCount = chainCinemas.filter((c) => c.brand === 'showtime').length
const vieshowBranchCount = chainCinemas.filter((c) => c.brand === 'vieshow').length
const miranewSourceBranches = new Set(miranew.layouts.map((l) => l.cinemaSlug))
const sourceBranches = vieshowBranchCount + showtimeBranchCount + miranewSourceBranches.size
const pending = pendingChainSeatSourceWorklist()
const pendingBranchCount = new Set(pending.map((r) => r.cinemaSlug)).size
const publishedHallCountItems = pending.filter((row) => row.publishedSeatCount !== null).length
const branchWithoutHallCensus = pending.filter((row) => row.hallLabel === null).length

// Miranew Tai-Mall's operator lists 11 distinct fixed halls in its public
// 2026-11-23 reference table. Only 8 public grid signatures exist in our
// archive, and the cross-source hall mapping is still a candidate. The three
// missing IDs are documented 2, 9 and 10; no fabricated geometry is added.
const taiMallSource = 'https://www.miranewcinemas.com/AboutUs/Index?type=taimall'
const taiMallOfficialHallLabels = [
  'IMAX',
  '2',
  '3',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'royal1',
  'royal2',
]
const taiMallObservedPatterns = miranew.layouts.filter(
  (x) => x.cinemaSlug === 'miranew-taimall',
).length
const taiMallMissingGridCandidates = taiMallOfficialHallLabels.length - taiMallObservedPatterns
const missingVieshowOfficialHallItems = vieShowManifest.totals.missingOfficialEntries
const sumsOfVieshowVenueMissing = vieShowManifest.venues.reduce(
  (sum, venue) => sum + venue.missingOfficialHalls.length,
  0,
)

if (
  chainCinemas.length !== 66 ||
  sourceBranches !== 39 ||
  pendingBranchCount !== 27 ||
  sourceBranches + pendingBranchCount !== chainCinemas.length ||
  vieShowManifest.totals.venues !== vieshowBranchCount ||
  vieShowManifest.totals.layouts !== 222 ||
  miranew.layouts.length !== 13 ||
  publishedHallCountItems !== 232 ||
  branchWithoutHallCensus !== 5 ||
  sumsOfVieshowVenueMissing !== missingVieshowOfficialHallItems ||
  taiMallMissingGridCandidates !== 3
) {
  throw new Error('Source inventory has changed: re-audit counts before publishing this report')
}

const privateArg = process.argv.find((arg) => arg.startsWith('--private-root='))
let privateShowtime: {
  sampledHallLabels: number
  verifiedHallLabels: number
  missingHallLabels: number
} | null = null
if (privateArg) {
  const privateRoot = path.resolve(privateArg.slice('--private-root='.length))
  // Only on the owner's MSI with an existing, authorised private source tree.
  const modUrl = pathToFileURL(path.join(privateRoot, 'scripts/showtime-local-catalogue.mjs')).href
  const module = (await import(modUrl)) as {
    readPrivateShowtimeCatalogue(root: string): {
      index: {
        sampledHallLabels: number
        verifiedHallLabels: number
        missingHallLabels: number
      }
    }
  }
  const { index } = module.readPrivateShowtimeCatalogue(privateRoot)
  privateShowtime = {
    sampledHallLabels: index.sampledHallLabels,
    verifiedHallLabels: index.verifiedHallLabels,
    missingHallLabels: index.missingHallLabels,
  }
}
const brandSummary = (
  ['ambassador', 'in89', 'broadway', 'centuryasia', 'skcinemas', 'miramar'] as const
).map((brand) => {
  const matching = pending.filter((x) => x.brand === brand)
  return {
    brand,
    pendingVenues: new Set(matching.map((x) => x.cinemaSlug)).size,
    capacityOnlyHallRecords: matching.filter((x) => x.publishedSeatCount !== null).length,
    branchesMissingIndividualHallCensus: matching.filter((x) => x.hallLabel === null).length,
  }
})

const checkedOn = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Taipei',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date())

const report = {
  sourceClassification: 'tracked-source-snapshot-not-live-total-operating-halls',
  checkedOn,
  venues: {
    chainVenueRecords: chainCinemas.length,
    withSomeSource3DPreviews: sourceBranches,
    withoutAnyVerifiedCompleteGrid: pendingBranchCount,
  },
  previews: {
    vieshowPublicGrids: vieShowManifest.totals.layouts,
    showtimeOwnerOnlyVerified: privateShowtime?.verifiedHallLabels ?? null,
    showtimeSampled: privateShowtime?.sampledHallLabels ?? null,
    showtimeMissingFromSample: privateShowtime?.missingHallLabels ?? null,
    miranewPublicPatternsNotVerifiedUniquePhysicalHalls: miranew.layouts.length,
    publicTotal: vieShowManifest.totals.layouts + miranew.layouts.length,
    publicPlusPrivateTotal: privateShowtime
      ? vieShowManifest.totals.layouts + miranew.layouts.length + privateShowtime.verifiedHallLabels
      : null,
  },
  outstandingRecordedWork: {
    branchesWithoutAnyCompleteGrid: pendingBranchCount,
    historicallyPublishedHallCapacityRecordsWithoutGrid: publishedHallCountItems,
    shinKongBranchesWithoutIndividualHallCensus: branchWithoutHallCensus,
    vieshowPublishedHallRecordsMissingAGrid: missingVieshowOfficialHallItems,
    vieshowMissingByVenue: vieShowManifest.venues
      .filter((venue) => venue.missingOfficialHalls.length > 0)
      .map((venue) => ({
        slug: venue.venueSlug,
        missingHallNumbers: venue.missingOfficialHalls,
      })),
    miranewTaiMallOfficialHallsWithoutObservedGrid: taiMallMissingGridCandidates,
    miranewTaiMallDirectSource: taiMallSource,
    unresolvedHallEvidenceItemsNotUniqueOperatingAuditoriums:
      publishedHallCountItems + missingVieshowOfficialHallItems + taiMallMissingGridCandidates,
    realCurrentUncoveredPhysicalHallCount: null,
  },
  pendingChains: brandSummary,
  warning:
    'Counts describe documented source records, not a confirmed census of operating halls. Some records are historical, and other halls are still uncatalogued. Private Showtime previews are never published.',
}
const json = JSON.stringify(report, null, 2) + '\n'
if (process.argv.includes('--save')) {
  const output = path.resolve('.tmp/source-3d-coverage/chain-coverage-' + checkedOn + '.json')
  fs.mkdirSync(path.dirname(output), { recursive: true })
  fs.writeFileSync(output, json)
}
console.log(json)
