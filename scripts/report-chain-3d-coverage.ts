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
import { broadwayPublicSeatSummary } from '../src/features/cinemas/broadway-seat-layouts'
import { centuryasiaPublicSeatSummary } from '../src/features/cinemas/centuryasia-seat-layouts'
import { in89PublicSeatSourceSummary } from '../src/features/cinemas/in89-public-seat-chart'
import { publishedVieshowHalls } from '../src/features/cinemas/vieshow-halls'
import {
  auditUnmatchedVieShowHallNumbers,
  summarizeUnmatchedHallAudits,
  type ObservedNamedHall,
} from '../src/features/cinemas/vieshow-hall-crosswalk'

const showtimeBranchCount = chainCinemas.filter((c) => c.brand === 'showtime').length
const vieshowBranchCount = chainCinemas.filter((c) => c.brand === 'vieshow').length
const miranewSourceBranches = new Set(miranew.layouts.map((l) => l.cinemaSlug))
const sourceBranches =
  vieshowBranchCount +
  showtimeBranchCount +
  miranewSourceBranches.size +
  broadwayPublicSeatSummary.sourcedVenues +
  centuryasiaPublicSeatSummary.sourcedVenues +
  in89PublicSeatSourceSummary.venueCount
const pending = pendingChainSeatSourceWorklist()
const pendingBranchCount = chainCinemas.length - sourceBranches
const branchesWithAtLeastOneOutstandingHall = new Set(pending.map((r) => r.cinemaSlug)).size
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
// These 24 historic 2026-05 numeric rows are *unmatched by direct number*.
// Some have a capacity-compatible existing grid under a newer/format name,
// which is only a CANDIDATE rather than an approved hall-identity mapping.
const vieShowOldNumberCrosswalk = vieShowManifest.venues
  .filter((venue) => venue.missingOfficialHalls.length > 0)
  .flatMap((venue) => {
    const filename = path.resolve(
      'src/features/cinemas/data/vieshow-snapshots-2026-11-16',
      venue.venueSlug + '.json',
    )
    const snapshot = JSON.parse(fs.readFileSync(filename, 'utf8')) as {
      schemaVersion: number
      venueSlug: string
      layouts: ObservedNamedHall[]
    }
    if (
      snapshot.schemaVersion !== 2 ||
      snapshot.venueSlug !== venue.venueSlug ||
      snapshot.layouts.length !== venue.observedLabels
    ) {
      throw new Error('Unexpected historical public archive version or venue data')
    }
    return auditUnmatchedVieShowHallNumbers(
      venue.missingOfficialHalls,
      publishedVieshowHalls.filter((item) => item.cinemaSlug === venue.venueSlug),
      snapshot.layouts,
    ).map((item) => ({ cinemaSlug: venue.venueSlug, ...item }))
  })
const vieShowCrosswalkCategories = summarizeUnmatchedHallAudits(vieShowOldNumberCrosswalk)
const numberRowsWithCountCompatibleSavedGrid =
  missingVieshowOfficialHallItems - vieShowCrosswalkCategories['no-capacity-compatible-saved-grid']

if (
  chainCinemas.length !== 66 ||
  sourceBranches !== 44 ||
  pendingBranchCount !== 22 ||
  sourceBranches + pendingBranchCount !== chainCinemas.length ||
  vieShowManifest.totals.venues !== vieshowBranchCount ||
  vieShowManifest.totals.layouts !== 222 ||
  miranew.layouts.length !== 13 ||
  publishedHallCountItems !== 216 ||
  branchesWithAtLeastOneOutstandingHall !== 27 ||
  branchWithoutHallCensus !== 5 ||
  sumsOfVieshowVenueMissing !== missingVieshowOfficialHallItems ||
  vieShowOldNumberCrosswalk.length !== missingVieshowOfficialHallItems ||
  numberRowsWithCountCompatibleSavedGrid !== 15 ||
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
    broadwayPublicGrids: broadwayPublicSeatSummary.verifiedHalls,
    centuryasiaPublicGrids: centuryasiaPublicSeatSummary.verifiedHalls,
    in89DatedPublicInstitutionGrids: in89PublicSeatSourceSummary.layoutCount,
    in89LatestPhysicalGridReconfirmed: false,
    publicTotal:
      vieShowManifest.totals.layouts +
      miranew.layouts.length +
      broadwayPublicSeatSummary.verifiedHalls +
      centuryasiaPublicSeatSummary.verifiedHalls +
      in89PublicSeatSourceSummary.layoutCount,
    publicPlusPrivateTotal: privateShowtime
      ? vieShowManifest.totals.layouts +
        miranew.layouts.length +
        broadwayPublicSeatSummary.verifiedHalls +
        centuryasiaPublicSeatSummary.verifiedHalls +
        in89PublicSeatSourceSummary.layoutCount +
        privateShowtime.verifiedHallLabels
      : null,
  },
  outstandingRecordedWork: {
    branchesWithoutAnyCompleteGrid: pendingBranchCount,
    branchesWithStillUnverifiedHallRecords: branchesWithAtLeastOneOutstandingHall,
    historicalHallCapacityRecords: 232,
    historicallyPublishedHallCapacityRecordsWithoutGrid: publishedHallCountItems,
    shinKongBranchesWithoutIndividualHallCensus: branchWithoutHallCensus,
    // Backward-compatible legacy field: means same-*numeric*-ID source not
    // found; 15 rows are also capacity-compatible with a differently labelled
    // source diagram. These are NOT 24 proven missing physical halls.
    vieshowPublishedHallRecordsMissingAGrid: missingVieshowOfficialHallItems,
    vieshowOldNumericRowsWithCapacityCompatibleExistingGrid: numberRowsWithCountCompatibleSavedGrid,
    vieshowOldNumericRowsWithoutCapacityCompatibleSavedGrid:
      vieShowCrosswalkCategories['no-capacity-compatible-saved-grid'],
    vieshowCrosswalkCandidateTypes: vieShowCrosswalkCategories,
    vieshowOldNumberToCurrentHallMappingVerified: false,
    vieshowCapacityCrosswalkResearchOnly: vieShowOldNumberCrosswalk.map((item) => ({
      cinemaSlug: item.cinemaSlug,
      oldPublishedHallNumber: item.oldPublishedHallNumber,
      oldPublishedSeatCount: item.oldPublishedSeatCount,
      evidenceClass: item.status,
      observedCandidateHallLabels: item.matches.map((match) => match.observedHallLabel),
      permanentHallIdentityConfirmed: false,
    })),
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
    'Counts describe documented source records, not a census of physical halls. Three Broadway and twelve Century Asia operator-public previews plus one dated Jan-Feb 2026 institutional in89 chart are source-backed. The November in89 physical layout has NOT been freshly verified, although current operator capacity still matches. Other halls remain unverified. Private Showtime previews never publish.',
}
const json = JSON.stringify(report, null, 2) + '\n'
if (process.argv.includes('--save')) {
  const output = path.resolve('.tmp/source-3d-coverage/chain-coverage-' + checkedOn + '.json')
  fs.mkdirSync(path.dirname(output), { recursive: true })
  fs.writeFileSync(output, json)
}
console.log(json)
