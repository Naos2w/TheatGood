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
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const SOURCE = 'showtime_authenticated_chrome_extension_read_only'
const EVIDENCE = 'signed_in_operator_preview_with_same_screening_card_venue_verified'
const METHOD = 'exact_venue_plus_hall_on_same_screening_card'
const IDENTITY = 'operator_screening_card_venue_and_hall_verified_not_surveyed'

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
export function auditShowtimeCoverage(census, archives, downloads) {
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
      assert.equal(raw.sourceUrl, 'https://www.showtimes.com.tw/')
      assert(Array.isArray(raw.layouts) && raw.layouts.length)
      const sha256 = crypto.createHash('sha256').update(bytes).digest('hex')
      const current = raw.sampledAt?.startsWith('2026-11-20')
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

  // For an unresolved same-hall geometry conflict, keep source evidence but
  // withhold "verified grid" status; never silently pick one version.
  const venueReports = names.map((slug) => {
    const byHall = stored.get(slug)
    const confirmed = [...byHall.values()].filter((hall) => hall.signatures.size === 1)
    const conflicting = [...byHall.values()].filter((hall) => hall.signatures.size > 1)
    const verifiedHallLabels = confirmed.map((x) => x.hallLabel).sort()
    return {
      cinemaSlug: slug,
      sampledHallNames: census.venues[slug].length,
      verifiedHallLabels,
      confirmedHallCount: verifiedHallLabels.length,
      confirmedHalls: confirmed
        .map((x) => ({
          hallLabel: x.hallLabel,
          seatCount: x.seatCount,
          sourceObservationCount: x.sourceObservationCount,
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
    // Report generation date in Taiwan, rather than the original UTC source batch date.
    asOf: new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Taipei' }).format(new Date()),
    sourceBatchUTCDate: '2026-11-20',
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
    sourceDiscrepancies: notes,
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
  const report = auditShowtimeCoverage(census, archived, downloads)
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
    }),
  )
  if (report.errors.length || report.sourceDiscrepancies.length) process.exitCode = 1
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCLI()
}
