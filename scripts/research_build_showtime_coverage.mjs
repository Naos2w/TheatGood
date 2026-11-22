/**
 * Compile research-only Showtime coverage from source-scoped operator data.
 * Public hall labels are not actual measured seating plans; booked or sold
 * statuses are never stored. No account, orders or application data touched.
 *
 * Run: npx tsx scripts/research_build_showtime_coverage.mjs
 */
import assert from 'node:assert/strict'
import console from 'node:console'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import { chainCinemas } from '../src/features/cinemas/chain-directory.ts'
import { cinemaPublishedFacts } from '../src/features/cinemas/other-chain-facts.ts'

const dir = fileURLToPath(new URL('../docs/research/theatgood-2026-11-18/', import.meta.url))
const filenames = fs.readdirSync(dir)
const venues = chainCinemas.filter((venue) => venue.brand === 'showtime')
assert.equal(venues.length, 15)
const allowed = new Set(venues.map((venue) => venue.slug))
const grids = new Map()
const publicHalls = new Map()
for (const filename of filenames) {
  if (/^showtime_preview_showtime-.*\.json$/.test(filename)) {
    const data = JSON.parse(fs.readFileSync(path.join(dir, filename), 'utf8'))
    assert(allowed.has(data.cinemaSlug), 'Unknown venue ' + filename)
    const legacyUI = data.sourceType === 'authorised_authenticated_operator_ui_seat_preview'
    const verifiedExtension =
      data.sourceType === 'showtime_authenticated_chrome_extension_read_only'
    assert(legacyUI || verifiedExtension, 'Unknown Showtime seat preview source')
    if (verifiedExtension) {
      assert.equal(data.venueMatchedOnIndividualSessionCard, true)
      assert.equal(data.venueVerificationMethod, 'exact_venue_plus_hall_on_same_screening_card')
      assert(
        typeof data.sourceRawSha256 === 'string' && /^[0-9a-f]{64}$/.test(data.sourceRawSha256),
      )
      assert.equal(
        data.sourceSessionCinemaName,
        venues.find((venue) => venue.slug === data.cinemaSlug)?.name,
      )
      assert.equal(
        data.sourceEvidence,
        'signed_in_operator_preview_with_same_screening_card_venue_verified',
      )
    }
    assert.equal(data.bookingActionPerformed, false)
    assert.equal(data.selectedSeats, 0)
    assert.equal(data.soldOrAvailableStateRetained, false)
    assert.equal(data.operatorImageCopied, false)
    assert(Number.isInteger(data.ordinarySeatCount) && data.ordinarySeatCount >= 20)
    assert.equal(data.seatPositions.length, data.ordinarySeatCount)
    const seatLabels = new Set()
    const seatCoords = new Set()
    for (const seat of data.seatPositions) {
      assert(typeof seat.label === 'string' && seat.label.length >= 2)
      assert(Number.isInteger(seat.gridRow) && seat.gridRow > 0)
      assert(Number.isInteger(seat.gridColumn) && seat.gridColumn > 0)
      const position = seat.gridRow + '/' + seat.gridColumn
      assert(
        !seatLabels.has(seat.label) && !seatCoords.has(position),
        'Duplicated seat in ' + filename,
      )
      seatLabels.add(seat.label)
      seatCoords.add(position)
    }
    const current = grids.get(data.cinemaSlug) ?? []
    assert(
      !current.some((other) => other.hallLabel === data.observedHallLabel),
      'Duplicate hall ' + filename,
    )
    current.push({
      hallLabel: data.observedHallLabel,
      sourceFile: filename,
      ordinarySeatLabels: data.ordinarySeatCount,
      numberOfRows: data.rowsCount,
      observedAt: data.observedAt,
      sourceLevel: verifiedExtension
        ? 'operator_authenticated_exact_screening_card_venue_and_hall_not_measured_metres'
        : 'operator_authenticated_seat_preview_source_not_measured_metres',
      sourceRawSha256: verifiedExtension ? data.sourceRawSha256 : null,
      physicalHallIdentityStatus: data.physicalHallIdentityStatus,
    })
    grids.set(data.cinemaSlug, current)
  }
  if (/^showtime_public_hall_census_showtime-.*\.json$/.test(filename)) {
    const row = JSON.parse(fs.readFileSync(path.join(dir, filename), 'utf8'))
    assert(allowed.has(row.cinemaSlug), 'Unknown hall census ' + filename)
    assert.equal(row.didNotOpenSeatPreview, true)
    assert.equal(row.didNotBook, true)
    assert.equal(row.hasCompleteSeatingGeometry, false)
    assert.equal(new Set(row.publicHallLabels).size, row.publicHallLabels.length)
    assert(!publicHalls.has(row.cinemaSlug), 'Duplicate public cinema census ' + filename)
    publicHalls.set(row.cinemaSlug, row)
  }
}
const records = venues.map((venue) => {
  const observed = grids.get(venue.slug) ?? []
  const publicSample = publicHalls.get(venue.slug)
  const operator = cinemaPublishedFacts[venue.slug]
  const labels = publicSample?.publicHallLabels ?? []
  const captured = observed.map((s) => s.hallLabel)
  const publicWithoutGrid = labels.filter((label) => !captured.includes(label))
  const officialWholeCount =
    operator?.hallCountScope === 'entire-cinema' ? operator.hallCount : null
  return {
    cinemaSlug: venue.slug,
    cinemaName: venue.name,
    sourceUrl: operator?.sourceUrl ?? venue.sourceUrl,
    advertisedHallCount: operator?.hallCount ?? null,
    advertisedHallCountScope: operator?.hallCountScope ?? 'unknown',
    advertisedVenueSeatCount: operator?.publishedSeatCount ?? null,
    authenticatedSeatGridCount: observed.length,
    authenticatedSeatGridHallLabels: [...captured].sort((a, b) => a.localeCompare(b, 'zh-TW')),
    authenticatedSeatLabelTotal: observed.reduce((n, x) => n + x.ordinarySeatLabels, 0),
    authenticatedGridEvidence: observed,
    publicHallCensusCollected: Boolean(publicSample),
    publicHallCensusMoviesReviewed: publicSample?.moviesSeen ?? null,
    publicHallLabelCount: labels.length,
    publicHallLabels: labels,
    publicNamedHallsWithoutSeatGrid: publicWithoutGrid,
    publishedWholeCinemaRoomsMinusObservedGrids:
      officialWholeCount === null ? null : Math.max(0, officialWholeCount - observed.length),
    dataStatus:
      observed.length > 0
        ? 'operator_auth_preview_grids_partly_collected'
        : publicSample
          ? 'public_hall_labels_only'
          : 'operator_venue_directory_only',
    countMeaningCaveat:
      'Number of film-associated hall labels in one public schedule sample is not the entire permanent hall inventory; an operator digital-halls-only count excludes special halls.',
    hasMeasuredSeatPitchOrScreenDistance: false,
    remainingCollection:
      'Authenticated seat preview screenshots or authorised UI reading; never infer an entire seating plan from seat totals.',
  }
})
const report = {
  observedOn: '2026-11-18',
  chain: 'showtime',
  researchOnly: true,
  venueCount: records.length,
  venuesWithAuthenticatedSeatGrids: records.filter((r) => r.authenticatedSeatGridCount > 0).length,
  venuesWithoutAuthenticatedSeatGrids: records.filter((r) => r.authenticatedSeatGridCount === 0)
    .length,
  savedAuthenticatedGridLayouts: records.reduce((sum, r) => sum + r.authenticatedSeatGridCount, 0),
  savedAuthenticatedSeatLabels: records.reduce((sum, r) => sum + r.authenticatedSeatLabelTotal, 0),
  venuesWithPublicHallCensus: records.filter((r) => r.publicHallCensusCollected).length,
  publicHallLabelsInSampledSchedules: records.reduce((sum, r) => sum + r.publicHallLabelCount, 0),
  publicHallLabelsWithoutSavedGrid: records.reduce(
    (sum, r) => sum + r.publicNamedHallsWithoutSeatGrid.length,
    0,
  ),
  selectedSeats: 0,
  placedOrders: 0,
  productionRecordsChanged: 0,
  warning:
    'The 15 active-chain operator venue candidates are not all physically verified current rooms. Public hall labels and authenticated seat grids come from different reading scopes. No precise 3D geometry is implied.',
  records,
}
assert(report.savedAuthenticatedGridLayouts >= 46)
assert(report.savedAuthenticatedSeatLabels >= 6358)
const file = path.join(dir, 'showtime_chain_coverage_2026-11-18.json')
fs.writeFileSync(file, JSON.stringify(report, null, 2) + '\n', 'utf8')
console.log(
  JSON.stringify({
    venues: report.venueCount,
    seatGridVenues: report.venuesWithAuthenticatedSeatGrids,
    savedGrids: report.savedAuthenticatedGridLayouts,
    seatLabels: report.savedAuthenticatedSeatLabels,
    publicCensusVenues: report.venuesWithPublicHallCensus,
    publicHallLabels: report.publicHallLabelsInSampledSchedules,
    publicLabelsWithoutGrid: report.publicHallLabelsWithoutSavedGrid,
    file,
  }),
)
