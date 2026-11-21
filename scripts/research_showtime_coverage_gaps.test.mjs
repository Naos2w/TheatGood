import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { URL } from 'node:url'
import { auditShowtimeCoverage } from './research_showtime_coverage_gaps.mjs'

const census = JSON.parse(
  readFileSync(
    new URL('./showtime-chrome-extension/operator-public-hall-census.json', import.meta.url),
    'utf8',
  ),
)

function sampleDownload(sampledAt, sourceUrl = 'https://www.showtimes.com.tw/') {
  const cinemaSlug = 'showtime-taichung-lipao'
  const cinemaName = '台中麗寶秀泰影城'
  const seats = Array.from({ length: 20 }, (_, index) => ({
    label: 'A排' + (index + 1) + '號',
    rowLabel: 'A',
    seatNumber: index + 1,
    gridRow: 1,
    gridColumn: index + 1,
  }))
  const source = {
    cinemaSlug,
    cinemaName,
    sourceType: 'showtime_authenticated_chrome_extension_read_only',
    researchOnly: true,
    venueVerificationMethod: 'exact_venue_plus_hall_on_same_screening_card',
    bookingActionPerformed: false,
    actualSeatClicked: 0,
    checkoutNotOpened: true,
    credentialsRead: false,
    seatAvailabilityRetained: false,
    sourceUrl,
    sampledAt,
    layouts: [
      {
        hallLabel: '1廳',
        sourceSessionCinemaName: cinemaName,
        venueMatchedOnIndividualSessionCard: true,
        sourceEvidence: 'signed_in_operator_preview_with_same_screening_card_venue_verified',
        ordinarySeatCount: 20,
        rowsCount: 1,
        seatPositions: seats,
        screenWidthM: null,
        screenHeightM: null,
        wheelchairLayoutVerified: false,
      },
    ],
  }
  return {
    filename: 'showtime_sample_showtime-taichung-lipao_1795211400000.json',
    bytes: Buffer.from(JSON.stringify(source)),
  }
}

test('audit counts midnight UTC downloads on the correct Taiwan calendar date', () => {
  // 20 November at 16:30 UTC is already 21 November at 00:30 in Taiwan.
  const downloads = [sampleDownload('2026-11-20T16:30:00.000Z')]
  const current = auditShowtimeCoverage(census, [], downloads, '2026-11-21')
  assert.equal(current.asOf, '2026-11-21')
  assert.equal(current.confirmedDifferentVenueHallLabels, 1)
  assert.equal(current.currentDayOriginalDownloads, 1)
  assert.equal(current.currentDaySeatGridObservations, 1)
  assert.equal(current.currentDayDistinctVenueHallLabels, 1)
  assert.deepEqual(current.errors, [])

  const priorDay = auditShowtimeCoverage(census, [], downloads, '2026-11-20')
  assert.equal(priorDay.currentDayOriginalDownloads, 0)
  assert.equal(priorDay.currentDaySeatGridObservations, 0)
  assert.equal(priorDay.currentDayDistinctVenueHallLabels, 0)
})

test('both exact Showtime HTTPS hosts are accepted; lookalike origins are rejected', () => {
  const stamp = '2026-11-21T10:01:00.000Z'
  const apex = auditShowtimeCoverage(
    census,
    [],
    [sampleDownload(stamp, 'https://showtimes.com.tw/')],
    '2026-11-21',
  )
  assert.equal(apex.confirmedDifferentVenueHallLabels, 1)
  assert.deepEqual(apex.errors, [])

  for (const sourceUrl of [
    'https://showtimes.com.tw.evil.example/',
    'http://showtimes.com.tw/',
    'https://showtimes.com.tw:8444/',
  ]) {
    const rejected = auditShowtimeCoverage(
      census,
      [],
      [sampleDownload(stamp, sourceUrl)],
      '2026-11-21',
    )
    assert.equal(rejected.confirmedDifferentVenueHallLabels, 0)
    assert.equal(rejected.errors.length, 1)
  }
})

test('invalid download timestamps are rejected without accepting the hall', () => {
  const report = auditShowtimeCoverage(census, [], [sampleDownload('not-a-date')], '2026-11-21')
  assert.equal(report.confirmedDifferentVenueHallLabels, 0)
  assert.equal(report.currentDayOriginalDownloads, 0)
  assert.equal(report.errors.length, 1)
})
