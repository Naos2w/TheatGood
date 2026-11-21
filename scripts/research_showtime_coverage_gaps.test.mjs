import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { auditShowtimeCoverage } from './research_showtime_coverage_gaps.mjs'

const SOURCE = 'showtime_authenticated_chrome_extension_read_only'
const METHOD = 'exact_venue_plus_hall_on_same_screening_card'
const EVIDENCE = 'signed_in_operator_preview_with_same_screening_card_venue_verified'
const IDENTITY = 'operator_screening_card_venue_and_hall_verified_not_surveyed'
const cinema = 'showtime-fixture-00'
const cinemaName = 'Synthetic Cinema (not an operator)'

function seats(count = 20) {
  return Array.from({ length: count }, (_, i) => ({
    label: 'A排' + (i + 1) + '號',
    rowLabel: 'A',
    seatNumber: i + 1,
    gridRow: 1,
    gridColumn: i + 1,
  }))
}
function inputs() {
  const census = {
    venues: Object.fromEntries(
      Array.from({ length: 15 }, (_, i) => [
        'showtime-fixture-' + String(i).padStart(2, '0'),
        ['1廳', '2廳'],
      ]),
    ),
  }
  const archived = [
    {
      sourceType: SOURCE,
      cinemaSlug: cinema,
      observedHallLabel: '1廳',
      observedAt: '2026-11-18T00:00:00.000Z',
      physicalHallIdentityStatus: IDENTITY,
      venueMatchedOnIndividualSessionCard: true,
      venueVerificationMethod: METHOD,
      ordinarySeatCount: 20,
      rowsCount: 1,
      seatPositions: seats(20),
    },
  ]
  const raw = {
    researchOnly: true,
    sourceType: SOURCE,
    venueVerificationMethod: METHOD,
    cinemaSlug: cinema,
    cinemaName,
    bookingActionPerformed: false,
    actualSeatClicked: 0,
    checkoutNotOpened: true,
    credentialsRead: false,
    seatAvailabilityRetained: false,
    sourceUrl: 'https://www.showtimes.com.tw/',
    sampledAt: '2026-11-20T12:00:00.000Z',
    layouts: [
      {
        hallLabel: '1廳',
        ordinarySeatCount: 20,
        rowsCount: 1,
        seatPositions: seats(20),
        venueMatchedOnIndividualSessionCard: true,
        sourceSessionCinemaName: cinemaName,
        sourceEvidence: EVIDENCE,
        screenWidthM: null,
        screenHeightM: null,
        wheelchairLayoutVerified: false,
      },
      {
        hallLabel: '2廳',
        ordinarySeatCount: 21,
        rowsCount: 1,
        seatPositions: seats(21),
        venueMatchedOnIndividualSessionCard: true,
        sourceSessionCinemaName: cinemaName,
        sourceEvidence: EVIDENCE,
        screenWidthM: null,
        screenHeightM: null,
        wheelchairLayoutVerified: false,
      },
    ],
  }
  const downloads = () => [
    {
      filename: 'showtime_sample_' + cinema + '_1234567890123.json',
      bytes: Buffer.from(JSON.stringify(raw), 'utf8'),
    },
  ]
  return { census, archived, raw, downloads }
}

test('counts same-card venue/hall identities without exposing individual seat labels or grids', () => {
  const x = inputs()
  const result = auditShowtimeCoverage(x.census, x.archived, x.downloads())
  assert.equal(result.numberOfVenues, 15)
  assert.match(result.asOf, /^\d{4}-\d{2}-\d{2}$/)
  assert.equal(result.sourceBatchUTCDate, '2026-11-20')
  assert.equal(result.sampledHallLabels, 30)
  assert.equal(result.confirmedDifferentVenueHallLabels, 2)
  assert.equal(result.missingFromSample, 28)
  assert.equal(result.previousVerifiedVenueHallLabels, 1)
  assert.equal(result.newlyConfirmedVenueHallLabels, 1)
  assert.equal(result.qualifiedOriginalDownloads, 1)
  assert.equal(result.currentDayOriginalDownloads, 1)
  assert.equal(result.currentDayDistinctVenueHallLabels, 2)
  assert.equal(result.venues[0].confirmedHalls[0].sourceObservationCount, 2)
  assert.deepEqual(result.errors, [])
  assert.deepEqual(result.sourceDiscrepancies, [])
  const json = JSON.stringify(result)
  assert(!json.includes('A排1號'))
  assert(!json.includes('gridColumn'))
  assert(!json.includes('credentialsRead'))
})

test('rejects a forged cinema-hall label rather than importing the seat grid', () => {
  const x = inputs()
  x.raw.layouts[1].sourceSessionCinemaName = 'Another Cinema'
  const result = auditShowtimeCoverage(x.census, x.archived, x.downloads())
  assert.equal(result.errors.length, 1)
  assert.equal(result.confirmedDifferentVenueHallLabels, 1)
  assert.equal(result.missingFromSample, 29)
})

test('records conflicting physical seat arrangements for one hall without choosing a winner', () => {
  const x = inputs()
  x.raw.layouts = [x.raw.layouts[0]]
  x.raw.layouts[0].seatPositions[0].gridColumn = 22
  const result = auditShowtimeCoverage(x.census, x.archived, x.downloads())
  assert.equal(result.errors.length, 0)
  assert.equal(result.sourceDiscrepancies.length, 1)
  assert.equal(result.confirmedDifferentVenueHallLabels, 0)
  assert.equal(result.venues[0].conflictingHallLabels[0], '1廳')
})

test('quarantines old sources without same-screening-card venue verification', () => {
  const x = inputs()
  x.archived[0].sourceType = 'authorised_authenticated_operator_ui_seat_preview'
  x.raw.venueVerificationMethod = undefined
  const result = auditShowtimeCoverage(x.census, x.archived, x.downloads())
  assert.equal(result.archivedLegacyResearchSnapshots, 1)
  assert.equal(result.excludedUnverifiedDownloads, 1)
  assert.equal(result.confirmedDifferentVenueHallLabels, 0)
  assert.equal(result.missingFromSample, 30)
})
