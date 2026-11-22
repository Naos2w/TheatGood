import assert from 'node:assert/strict'
import crypto from 'node:crypto'
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

const testSha = (data) => crypto.createHash('sha256').update(data).digest('hex')

function reviewedHallFixtures() {
  // Entirely synthetic 321/382-seat geometry. Never load or commit private seat grids.
  const makeSeats = (newer) => {
    const countByRow = newer ? [...Array(16).fill(22), 30] : [...Array(15).fill(20), 21]
    return countByRow.flatMap((count, index) =>
      Array.from({ length: count }, (_, n) => {
        const rowLabel = String.fromCharCode(65 + index)
        return {
          label: rowLabel + '排' + (n + 1) + '號',
          rowLabel,
          seatNumber: n + 1,
          gridRow: index + 1,
          gridColumn: n + 1 + Number(newer),
        }
      }),
    )
  }
  const old = makeSeats(false)
  const current = makeSeats(true)
  const signature = (seats) =>
    testSha(
      seats
        .map(({ label, gridRow, gridColumn }) => label + '@' + gridRow + '/' + gridColumn)
        .sort()
        .join('|'),
    )
  const makeDownload = (seats, timestamp, suffix) => {
    const cinemaSlug = 'showtime-taipei-xinxin'
    const cinemaName = '台北欣欣秀泰影城'
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
      sourceUrl: 'https://showtimes.com.tw/',
      sampledAt: timestamp,
      layouts: [
        {
          hallLabel: '1廳',
          sourceSessionCinemaName: cinemaName,
          venueMatchedOnIndividualSessionCard: true,
          sourceEvidence: 'signed_in_operator_preview_with_same_screening_card_venue_verified',
          ordinarySeatCount: seats.length,
          rowsCount: new Set(seats.map((seat) => seat.gridRow)).size,
          seatPositions: seats,
          screenWidthM: null,
          screenHeightM: null,
          wheelchairLayoutVerified: false,
        },
      ],
    }
    const bytes = Buffer.from(JSON.stringify(source))
    return {
      filename: 'showtime_sample_showtime-taipei-xinxin_' + suffix + '.json',
      bytes,
      digest: testSha(bytes),
    }
  }
  const oldRaw = makeDownload(old, '2026-11-21T14:00:00Z', '1795271000001')
  const currentA = makeDownload(current, '2026-11-21T15:00:00Z', '1795271000002')
  const currentB = makeDownload(current, '2026-11-21T16:00:00Z', '1795271000003')
  const archives = [
    {
      sourceType: 'showtime_authenticated_chrome_extension_read_only',
      cinemaSlug: 'showtime-taipei-xinxin',
      observedHallLabel: '1廳',
      physicalHallIdentityStatus: 'operator_screening_card_venue_and_hall_verified_not_surveyed',
      venueMatchedOnIndividualSessionCard: true,
      venueVerificationMethod: 'exact_venue_plus_hall_on_same_screening_card',
      ordinarySeatCount: current.length,
      rowsCount: 17,
      seatPositions: current,
      sourceRawSha256: currentB.digest,
      observedAt: '2026-11-21T16:00:00Z',
    },
  ]
  const review = {
    version: 1,
    researchOnly: true,
    approvedForProduction: false,
    cinemaSlug: 'showtime-taipei-xinxin',
    hallLabel: '1廳',
    preferredSeatCount: 382,
    preferredRowsCount: 17,
    preferredGeometrySignature: signature(current),
    preferredSourceHashes: [currentA.digest, currentB.digest],
    oldSeatCount: 321,
    oldRowsCount: 16,
    oldGeometrySignature: signature(old),
    oldSourceHash: oldRaw.digest,
    reviewBasis: 'Two independent same-screening-card sources plus published historical capacity',
    governmentReference: {
      agency: '文化部影視及流行音樂產業局',
      publishedOn: '2021-11-30',
      cinemaName: '欣欣秀泰影城(欣欣晶華戲院)',
      hallLabel: '1廳',
      recordedSeatCount: 382,
      url: 'https://file.moc.gov.tw/Download.ashx?synthetic-test-only=true',
    },
  }
  return { archives, downloads: [oldRaw, currentA, currentB], review, makeDownload, current }
}

test('strict source review requires two matching exact-source 382-seat captures and preserves conflict history', () => {
  const fixture = reviewedHallFixtures()
  const unreviewed = auditShowtimeCoverage(
    census,
    fixture.archives,
    fixture.downloads,
    '2026-11-22',
  )
  assert.equal(unreviewed.confirmedDifferentVenueHallLabels, 0)
  assert(unreviewed.sourceDiscrepancies.length > 0)

  const accepted = auditShowtimeCoverage(
    census,
    fixture.archives,
    fixture.downloads,
    '2026-11-22',
    [fixture.review],
  )
  assert.equal(accepted.confirmedDifferentVenueHallLabels, 1)
  assert.deepEqual(accepted.errors, [])
  assert.deepEqual(accepted.sourceDiscrepancies, [])
  assert.equal(accepted.resolvedSourceDiscrepancies.length, 1)
  assert.equal(
    accepted.venues.find((v) => v.cinemaSlug === 'showtime-taipei-xinxin').confirmedHalls[0]
      .seatCount,
    382,
  )
})

test('falsified government capacity or missing operator SHA cannot clear a reviewed source conflict', () => {
  const f = reviewedHallFixtures()
  for (const override of [
    { governmentReference: { ...f.review.governmentReference, recordedSeatCount: 321 } },
    { preferredSourceHashes: [f.review.preferredSourceHashes[0], 'f'.repeat(64)] },
    { preferredRowsCount: 16 },
  ]) {
    const attempted = { ...f.review, ...override }
    const audit = auditShowtimeCoverage(census, f.archives, f.downloads, '2026-11-22', [attempted])
    assert.equal(audit.confirmedDifferentVenueHallLabels, 0)
    assert.equal(audit.errors.length, 1)
    assert(audit.sourceDiscrepancies.length > 0)
  }
})

test('a third changed grid signature reopens a formerly reviewed hall conflict', () => {
  const f = reviewedHallFixtures()
  const extraSeat = {
    label: 'Q排31號',
    rowLabel: 'Q',
    seatNumber: 31,
    gridRow: 17,
    gridColumn: 32,
  }
  const third = f.makeDownload([...f.current, extraSeat], '2026-11-21T17:00:00Z', '1795271000004')
  const audit = auditShowtimeCoverage(census, f.archives, [...f.downloads, third], '2026-11-22', [
    f.review,
  ])
  assert.equal(audit.confirmedDifferentVenueHallLabels, 0)
  assert.equal(audit.errors.length, 1)
  assert(audit.sourceDiscrepancies.length > 0)
})
