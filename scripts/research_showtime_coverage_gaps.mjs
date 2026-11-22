/**
 * Strict metadata-only audit for authorised Showtime research downloads.
 *
 * Three CLI arguments are LOCAL absolute paths:
 *   node scripts/research_showtime_coverage_gaps.mjs <archived-research-dir> <download-dir> <public-hall-census.json>
 *
 * The operator hall-name census is a sample, NOT a complete physical-hall
 * inventory. No source seat coordinates, account state, sold/available state,
 * credentials, URLs with session tokens, or raw downloads are exported.
 *
 * Never writes into the original research/download directories. Optional
 * --output=<filename> writes the metadata report only to that exact path.
 */
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import console from 'node:console'
import { Buffer } from 'node:buffer'
import { URL, fileURLToPath } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const SOURCE = 'showtime_authenticated_chrome_extension_read_only'
const EVIDENCE = 'signed_in_operator_preview_with_same_screening_card_venue_verified'
const METHOD = 'exact_venue_plus_hall_on_same_screening_card'
const IDENTITY = 'operator_screening_card_venue_and_hall_verified_not_surveyed'

function taipeiCalendarDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${values.year}-${values.month}-${values.day}`
}

function signature(seats) {
  return crypto
    .createHash('sha256')
    .update(
      seats
        .map(({ label, gridRow, gridColumn }) => label + '@' + gridRow + '/' + gridColumn)
        .sort()
        .join('|'),
    )
    .digest('hex')
}

function validateSeats(layout) {
  assert(Number.isInteger(layout.ordinarySeatCount) && layout.ordinarySeatCount >= 20)
  assert(Array.isArray(layout.seatPositions))
  assert.equal(layout.seatPositions.length, layout.ordinarySeatCount)
  const labels = new Set()
  const coords = new Set()
  const rows = new Set()
  for (const seat of layout.seatPositions) {
    assert(seat && typeof seat.label === 'string')
    assert(/^[A-Za-z0-9]+排[0-9]+號$/.test(seat.label))
    assert(Number.isInteger(seat.gridRow) && seat.gridRow > 0 && seat.gridRow <= 150)
    assert(Number.isInteger(seat.gridColumn) && seat.gridColumn > 0 && seat.gridColumn <= 150)
    assert(!labels.has(seat.label), 'Duplicated actual seat label')
    labels.add(seat.label)
    const cell = seat.gridRow + '/' + seat.gridColumn
    assert(!coords.has(cell), 'Duplicated actual grid cell')
    coords.add(cell)
    rows.add(seat.gridRow)
    if (seat.rowLabel !== undefined)
      assert.equal(seat.label, seat.rowLabel + '排' + seat.seatNumber + '號')
  }
  assert.equal(rows.size, layout.rowsCount)
}

/** Pure provenance-preserving index: does not mutate any input object. */
export function auditShowtimeCoverage(
  census,
  archives,
  downloads,
  asOf = taipeiCalendarDate(),
  sourceReviews = [],
) {
  assert(census && typeof census.venues === 'object')
  const names = Object.keys(census.venues).sort()
  assert.equal(names.length, 15, 'Known chain inventory must contain all 15 venue samples')
  for (const slug of names) {
    assert(/^showtime-[a-z0-9-]+$/.test(slug))
    assert(Array.isArray(census.venues[slug]) && census.venues[slug].length)
    assert.equal(new Set(census.venues[slug]).size, census.venues[slug].length)
  }
  const stored = new Map(names.map((slug) => [slug, new Map()]))
  const reference = new Set()
  const notes = []
  const observations = new Map()
  let legacySnapshots = 0
  for (const archive of archives) {
    if (archive.sourceType !== SOURCE) {
      legacySnapshots++
      continue
    }
    const slug = archive.cinemaSlug
    assert(stored.has(slug), 'Archived verified venue not in public census')
    assert(census.venues[slug].includes(archive.observedHallLabel), 'Archived hall not in census')
    assert.equal(archive.physicalHallIdentityStatus, IDENTITY)
    assert.equal(archive.venueMatchedOnIndividualSessionCard, true)
    assert.equal(archive.venueVerificationMethod, METHOD)
    validateSeats(archive)
    const key = slug + '|' + archive.observedHallLabel
    reference.add(key)
    const byHall = stored.get(slug)
    const value = {
      hallLabel: archive.observedHallLabel,
      seatCount: archive.ordinarySeatCount,
      signatures: new Set([signature(archive.seatPositions)]),
      sourceObservationCount: 1,
      firstObservedAt: archive.observedAt,
    }
    assert(!byHall.has(value.hallLabel), 'Duplicated archived verified hall source')
    byHall.set(value.hallLabel, value)
  }

  let qualifiedDownloads = 0
  let excludedDownloads = 0
  let currentDayDownloads = 0
  let currentDayObservations = 0
  const fileDigests = []
  const errors = []
  const currentDayKeys = new Set()

  for (const download of downloads) {
    const { filename, bytes } = download
    assert(Buffer.isBuffer(bytes))
    const raw = JSON.parse(bytes.toString('utf8'))
    if (
      raw.sourceType !== SOURCE ||
      raw.venueVerificationMethod !== METHOD ||
      raw.researchOnly !== true
    ) {
      excludedDownloads++
      continue
    }
    qualifiedDownloads++
    try {
      assert(stored.has(raw.cinemaSlug), 'Not an allowlisted cinema')
      assert(/^showtime_sample_showtime-[a-z0-9-]+_[0-9]+\.json$/.test(filename))
      assert(filename.startsWith('showtime_sample_' + raw.cinemaSlug + '_'))
      assert.equal(raw.bookingActionPerformed, false)
      assert.equal(raw.actualSeatClicked, 0)
      assert.equal(raw.checkoutNotOpened, true)
      assert.equal(raw.credentialsRead, false)
      assert.equal(raw.seatAvailabilityRetained, false)
      assert(
        ['https://www.showtimes.com.tw/', 'https://showtimes.com.tw/'].includes(raw.sourceUrl),
        'Showtime source must match one of two exact official HTTPS hosts',
      )
      assert(Array.isArray(raw.layouts) && raw.layouts.length)
      const sha256 = crypto.createHash('sha256').update(bytes).digest('hex')
      const sampledAtTime = Date.parse(raw.sampledAt)
      assert(Number.isFinite(sampledAtTime), 'Invalid source observation timestamp')
      const current = taipeiCalendarDate(new Date(sampledAtTime)) === asOf
      if (current) currentDayDownloads++
      fileDigests.push({
        cinemaSlug: raw.cinemaSlug,
        filename,
        sha256,
        sourcedHallCount: raw.layouts.length,
        observedAt: raw.sampledAt,
      })
      for (const layout of raw.layouts) {
        assert.equal(layout.venueMatchedOnIndividualSessionCard, true)
        assert.equal(layout.sourceSessionCinemaName, raw.cinemaName)
        assert.equal(layout.sourceEvidence, EVIDENCE)
        assert(census.venues[raw.cinemaSlug].includes(layout.hallLabel))
        validateSeats(layout)
        assert(layout.screenWidthM == null && layout.screenHeightM == null)
        assert.equal(layout.wheelchairLayoutVerified, false)
        const byHall = stored.get(raw.cinemaSlug)
        const sign = signature(layout.seatPositions)
        const observationKey = raw.cinemaSlug + '|' + layout.hallLabel
        const hallObservations = observations.get(observationKey) ?? []
        hallObservations.push({
          sourceSha256: sha256,
          signature: sign,
          seatCount: layout.ordinarySeatCount,
          rowsCount: layout.rowsCount,
          labels: new Set(layout.seatPositions.map((seat) => seat.label)),
        })
        observations.set(observationKey, hallObservations)
        const prior = byHall.get(layout.hallLabel)
        if (prior) {
          if (prior.seatCount !== layout.ordinarySeatCount || !prior.signatures.has(sign)) {
            notes.push({
              cinemaSlug: raw.cinemaSlug,
              hallLabel: layout.hallLabel,
              issue: 'same-hall-grid-conflict-requires-review',
            })
          }
          prior.signatures.add(sign)
          prior.sourceObservationCount++
        } else {
          byHall.set(layout.hallLabel, {
            hallLabel: layout.hallLabel,
            seatCount: layout.ordinarySeatCount,
            signatures: new Set([sign]),
            sourceObservationCount: 1,
            firstObservedAt: raw.sampledAt,
          })
        }
        if (current) {
          currentDayObservations++
          currentDayKeys.add(raw.cinemaSlug + '|' + layout.hallLabel)
        }
      }
    } catch (error) {
      errors.push({
        cinemaSlug: String(raw.cinemaSlug ?? 'unknown'),
        filename,
        reason: error instanceof Error ? error.message : 'Invalid source',
      })
    }
  }

  // A historical discrepancy is never cleared by seat count alone. Only a
  // review with exact independently repeated operator geometry, explicit
  // archival provenance and independently published venue capacity may prefer
  // one old layout. Any NEW conflicting signature re-opens review.
  const acceptedReviews = new Map()
  assert(Array.isArray(sourceReviews), 'Source reviews must be an array')
  for (const review of sourceReviews) {
    try {
      assert(review && review.version === 1 && review.researchOnly === true)
      assert.equal(review.approvedForProduction, false)
      assert.equal(review.cinemaSlug, 'showtime-taipei-xinxin')
      assert.equal(review.hallLabel, '1廳')
      assert.equal(review.preferredSeatCount, 382)
      assert.equal(review.preferredRowsCount, 17)
      assert.equal(review.oldSeatCount, 321)
      assert.equal(review.oldRowsCount, 16)
      assert(/^[0-9a-f]{64}$/.test(review.preferredGeometrySignature))
      assert(/^[0-9a-f]{64}$/.test(review.oldGeometrySignature))
      assert(/^[0-9a-f]{64}$/.test(review.oldSourceHash))
      assert(Array.isArray(review.preferredSourceHashes))
      assert.equal(review.preferredSourceHashes.length, 2)
      assert.equal(new Set(review.preferredSourceHashes).size, 2)
      assert(review.preferredSourceHashes.every((sha) => /^[0-9a-f]{64}$/.test(sha)))
      const government = review.governmentReference
      assert.equal(government.agency, '文化部影視及流行音樂產業局')
      assert.equal(government.publishedOn, '2021-11-30')
      assert.equal(government.cinemaName, '欣欣秀泰影城(欣欣晶華戲院)')
      assert.equal(government.hallLabel, review.hallLabel)
      assert.equal(government.recordedSeatCount, review.preferredSeatCount)
      const sourceURL = new URL(government.url)
      assert.equal(sourceURL.origin, 'https://file.moc.gov.tw')
      assert.equal(sourceURL.pathname, '/Download.ashx')
      assert(review.reviewBasis?.includes('same-screening-card'))
      const key = review.cinemaSlug + '|' + review.hallLabel
      assert(!acceptedReviews.has(key), 'Duplicate review')
      const entries = observations.get(key) ?? []
      const preferred = review.preferredSourceHashes.map((sha) =>
        entries.find((entry) => entry.sourceSha256 === sha),
      )
      assert(preferred.every(Boolean), 'Accepted source SHA missing')
      assert(
        preferred.every(
          (entry) =>
            entry.signature === review.preferredGeometrySignature &&
            entry.seatCount === review.preferredSeatCount &&
            entry.rowsCount === review.preferredRowsCount,
        ),
        'Two preferred raw captures do not have identical verified geometry',
      )
      const old = entries.find((entry) => entry.sourceSha256 === review.oldSourceHash)
      assert(old, 'Original conflicting source SHA missing')
      assert.equal(old.signature, review.oldGeometrySignature)
      assert.equal(old.seatCount, review.oldSeatCount)
      assert.equal(old.rowsCount, review.oldRowsCount)
      assert(
        [...old.labels].every((label) => preferred[0].labels.has(label)),
        'Old labels are not a subset of independently verified preferred source',
      )
      const archived = archives.find(
        (entry) =>
          entry.sourceType === SOURCE &&
          entry.cinemaSlug === review.cinemaSlug &&
          entry.observedHallLabel === review.hallLabel,
      )
      assert(archived, 'Preferred normalized archive not yet reviewed and installed')
      assert(review.preferredSourceHashes.includes(archived.sourceRawSha256))
      assert.equal(archived.ordinarySeatCount, review.preferredSeatCount)
      assert.equal(signature(archived.seatPositions), review.preferredGeometrySignature)
      const selected = stored.get(review.cinemaSlug)?.get(review.hallLabel)
      assert(selected, 'Conflicted hall missing in source audit')
      assert.equal(selected.signatures.size, 2, 'New geometry signature requires fresh review')
      assert(selected.signatures.has(review.oldGeometrySignature))
      assert(selected.signatures.has(review.preferredGeometrySignature))
      acceptedReviews.set(key, review)
    } catch (error) {
      errors.push({
        cinemaSlug: String(review?.cinemaSlug ?? 'unknown'),
        filename: 'showtime_conflict_review',
        reason: error instanceof Error ? error.message : 'Invalid source review',
      })
    }
  }

  // For an unresolved same-hall geometry conflict, keep source evidence but
  // withhold "verified grid" status; never silently pick one version.
  const venueReports = names.map((slug) => {
    const byHall = stored.get(slug)
    const trusted = (hall) =>
      hall.signatures.size === 1 || acceptedReviews.has(slug + '|' + hall.hallLabel)
    const confirmed = [...byHall.values()].filter(trusted)
    const conflicting = [...byHall.values()].filter((hall) => !trusted(hall))
    const verifiedHallLabels = confirmed.map((x) => x.hallLabel).sort()
    return {
      cinemaSlug: slug,
      sampledHallNames: census.venues[slug].length,
      verifiedHallLabels,
      confirmedHallCount: verifiedHallLabels.length,
      confirmedHalls: confirmed
        .map((x) => ({
          hallLabel: x.hallLabel,
          seatCount:
            acceptedReviews.get(slug + '|' + x.hallLabel)?.preferredSeatCount ?? x.seatCount,
          sourceObservationCount: x.sourceObservationCount,
          historicalConflictReviewed: acceptedReviews.has(slug + '|' + x.hallLabel),
        }))
        .sort((a, b) => a.hallLabel.localeCompare(b.hallLabel, 'zh-TW')),
      conflictingHallLabels: conflicting.map((x) => x.hallLabel),
      missingHallLabels: census.venues[slug]
        .filter((hall) => !verifiedHallLabels.includes(hall))
        .sort(),
    }
  })
  const allConfirmed = venueReports.flatMap((v) =>
    v.verifiedHallLabels.map((hall) => v.cinemaSlug + '|' + hall),
  )
  const report = {
    asOf,
    researchOnly: true,
    approvedForPublicUI: false,
    seatGeometryMeasured: false,
    localOriginalDownloadsUnchanged: true,
    numberOfVenues: names.length,
    sampledHallLabels: venueReports.reduce((sum, v) => sum + v.sampledHallNames, 0),
    confirmedDifferentVenueHallLabels: allConfirmed.length,
    missingFromSample: venueReports.reduce((sum, v) => sum + v.missingHallLabels.length, 0),
    previousVerifiedVenueHallLabels: reference.size,
    newlyConfirmedVenueHallLabels: allConfirmed.filter((id) => !reference.has(id)).length,
    archivedLegacyResearchSnapshots: legacySnapshots,
    qualifiedOriginalDownloads: qualifiedDownloads,
    excludedUnverifiedDownloads: excludedDownloads,
    currentDayOriginalDownloads: currentDayDownloads,
    currentDaySeatGridObservations: currentDayObservations,
    currentDayDistinctVenueHallLabels: currentDayKeys.size,
    errors,
    sourceDiscrepancies: notes.filter(
      (entry) => !acceptedReviews.has(entry.cinemaSlug + '|' + entry.hallLabel),
    ),
    resolvedSourceDiscrepancies: notes
      .filter((entry) => acceptedReviews.has(entry.cinemaSlug + '|' + entry.hallLabel))
      .map((entry) => ({
        ...entry,
        status: 'independently-reviewed-historical-geometry-conflict',
        preferredSeatCount: acceptedReviews.get(entry.cinemaSlug + '|' + entry.hallLabel)
          .preferredSeatCount,
        governmentPublishedOn: acceptedReviews.get(entry.cinemaSlug + '|' + entry.hallLabel)
          .governmentReference.publishedOn,
        oldAndNewSourcesRetained: true,
      })),
    venues: venueReports,
    downloadedSourceDigests: fileDigests,
  }
  return report
}

function asciiJson(value) {
  const json = JSON.stringify(value, null, 2)
  let ascii = ''
  for (let i = 0; i < json.length; i++) {
    const char = json.charCodeAt(i)
    ascii += char > 127 ? '\\u' + char.toString(16).padStart(4, '0') : json[i]
  }
  return ascii + '\n'
}

function runCLI() {
  const [researchDir, downloadsDir, censusPath, ...args] = process.argv.slice(2)
  assert(
    researchDir && downloadsDir && censusPath,
    'Usage: script <research> <downloads> <hall-census.json>',
  )
  const census = JSON.parse(fs.readFileSync(path.resolve(censusPath), 'utf8'))
  const archived = fs
    .readdirSync(path.resolve(researchDir))
    .filter((file) => /^showtime_preview_showtime-.*\.json$/.test(file))
    .map((file) => JSON.parse(fs.readFileSync(path.join(path.resolve(researchDir), file), 'utf8')))
  const downloads = fs
    .readdirSync(path.resolve(downloadsDir))
    .filter((file) => /^showtime_sample_showtime-[a-z0-9-]+_[0-9]+\.json$/.test(file))
    .map((filename) => ({
      filename,
      bytes: fs.readFileSync(path.join(path.resolve(downloadsDir), filename)),
    }))
  const sourceReviews = fs
    .readdirSync(path.resolve(researchDir))
    .filter((name) => /^showtime_conflict_review_.*\.json$/.test(name))
    .map((name) => {
      const review = JSON.parse(fs.readFileSync(path.join(path.resolve(researchDir), name), 'utf8'))
      if (review.cinemaSlug === 'showtime-taipei-xinxin' && review.hallLabel === '1廳') {
        const backup = path.join(
          path.resolve(researchDir),
          'showtime_conflict_backup_showtime-taipei-xinxin_1廳_321_20261122.json',
        )
        assert(fs.existsSync(backup), 'Historical 321-seat source backup must remain present')
        assert(
          /^[0-9a-f]{64}$/.test(review.oldArchiveHash),
          'Historical source backup hash missing',
        )
        assert.equal(
          crypto.createHash('sha256').update(fs.readFileSync(backup)).digest('hex'),
          review.oldArchiveHash,
          'Historical source backup hash changed',
        )
      }
      return review
    })
  const report = auditShowtimeCoverage(
    census,
    archived,
    downloads,
    taipeiCalendarDate(),
    sourceReviews,
  )
  const output = args.find((arg) => arg.startsWith('--output='))
  if (output) {
    const outputPath = path.resolve(output.slice('--output='.length))
    assert(
      !outputPath.startsWith(path.resolve(researchDir) + path.sep),
      'Refuse to write into research originals',
    )
    assert(
      !outputPath.startsWith(path.resolve(downloadsDir) + path.sep),
      'Refuse to write into downloads',
    )
    fs.writeFileSync(outputPath, asciiJson(report), 'utf8')
  }
  console.log(
    asciiJson({
      asOf: report.asOf,
      numberOfVenues: report.numberOfVenues,
      sampledHallLabels: report.sampledHallLabels,
      verifiedHallLabels: report.confirmedDifferentVenueHallLabels,
      missingHallLabels: report.missingFromSample,
      newlyConfirmedVenueHallLabels: report.newlyConfirmedVenueHallLabels,
      qualifiedOriginalDownloads: report.qualifiedOriginalDownloads,
      currentDayOriginalDownloads: report.currentDayOriginalDownloads,
      errors: report.errors,
      sourceDiscrepancies: report.sourceDiscrepancies,
      resolvedSourceDiscrepancies: report.resolvedSourceDiscrepancies,
    }),
  )
  if (report.errors.length || report.sourceDiscrepancies.length) process.exitCode = 1
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCLI()
}
