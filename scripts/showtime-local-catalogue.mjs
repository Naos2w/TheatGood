/**
 * In-memory, local-only Showtime research catalogue for Vite dev middleware.
 * Never writes or stages any seat grid. Do not expose via Vite preview/build.
 * A hall is available only when the full private metadata audit confirms its
 * exact official screening-card venue+hall and any historical review is valid.
 */
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { auditShowtimeCoverage } from './research_showtime_coverage_gaps.mjs'

const SOURCE = 'showtime_authenticated_chrome_extension_read_only'
const METHOD = 'exact_venue_plus_hall_on_same_screening_card'
const EVIDENCE = 'signed_in_operator_preview_with_same_screening_card_venue_verified'
const IDENTITY = 'operator_screening_card_venue_and_hall_verified_not_surveyed'
const sourceDigest = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex')

/** Build once per request; the source is private to this device, not a Vite asset. */
export function createShowtimeLocalCatalogue(census, archives, downloads, reviews = []) {
  const report = auditShowtimeCoverage(census, archives, downloads, undefined, reviews)
  assert.deepEqual(report.errors, [], 'Reject unsafe or invalid research sources')
  assert.deepEqual(report.sourceDiscrepancies, [], 'Reject unresolved seat-grid conflicts')
  const confirmed = new Set(
    report.venues.flatMap((v) => v.verifiedHallLabels.map((hall) => v.cinemaSlug + '|' + hall)),
  )
  const resolved = new Map(
    reviews.map((review) => [review.cinemaSlug + '|' + review.hallLabel, review]),
  )
  const chosen = new Map()
  for (const { filename, bytes } of downloads) {
    const raw = JSON.parse(bytes.toString('utf8'))
    if (
      raw.sourceType !== SOURCE ||
      raw.venueVerificationMethod !== METHOD ||
      raw.researchOnly !== true ||
      raw.bookingActionPerformed !== false ||
      raw.actualSeatClicked !== 0 ||
      raw.credentialsRead !== false ||
      raw.seatAvailabilityRetained !== false
    ) {
      continue
    }
    const digest = sourceDigest(bytes)
    assert(/^showtime_sample_showtime-[a-z0-9-]+_[0-9]+\.json$/.test(filename))
    for (const layout of raw.layouts) {
      const key = raw.cinemaSlug + '|' + layout.hallLabel
      if (!confirmed.has(key)) continue
      const review = resolved.get(key)
      if (review && !review.preferredSourceHashes.includes(digest)) continue
      assert(layout.venueMatchedOnIndividualSessionCard === true)
      assert(layout.sourceSessionCinemaName === raw.cinemaName)
      assert(layout.sourceEvidence === EVIDENCE)
      const snapshot = {
        sourceType: SOURCE,
        cinemaSlug: raw.cinemaSlug,
        observedHallLabel: layout.hallLabel,
        observedAt: raw.sampledAt,
        physicalHallIdentityStatus: IDENTITY,
        relativeGridUnit: 'operator_css_layout_cells_not_metres',
        ordinarySeatCount: layout.ordinarySeatCount,
        rowsCount: layout.rowsCount,
        seatPositions: layout.seatPositions.map((seat) => ({
          label: seat.label,
          rowLabel: seat.rowLabel,
          seatNumber: seat.seatNumber,
          gridRow: seat.gridRow,
          gridColumn: seat.gridColumn,
        })),
        sourceLandingUrl: raw.sourceUrl,
        sourceSessionCinemaName: raw.cinemaName,
        venueMatchedOnIndividualSessionCard: true,
        venueVerificationMethod: METHOD,
        sourceEvidence: EVIDENCE,
        sourceRawSha256: digest,
        selectedSeats: 0,
        bookingActionPerformed: false,
        soldOrAvailableStateRetained: false,
        operatorImageCopied: false,
      }
      const prior = chosen.get(key)
      if (!prior || Date.parse(prior.observedAt) < Date.parse(snapshot.observedAt)) {
        chosen.set(key, snapshot)
      }
    }
  }
  for (const archive of archives) {
    const key = archive.cinemaSlug + '|' + archive.observedHallLabel
    if (!confirmed.has(key) || chosen.has(key)) continue
    if (
      archive.sourceType !== SOURCE ||
      archive.venueMatchedOnIndividualSessionCard !== true ||
      archive.venueVerificationMethod !== METHOD ||
      !/^[0-9a-f]{64}$/.test(archive.sourceRawSha256 ?? '')
    ) {
      continue
    }
    chosen.set(key, archive)
  }
  const missing = [...confirmed].filter((key) => !chosen.has(key))
  assert.deepEqual(missing, [], 'Source-verified hall has no independently verified seat grid')
  const venues = Object.fromEntries(
    Object.keys(census.venues).map((slug) => {
      const halls = [...chosen]
        .filter(([key]) => key.startsWith(slug + '|'))
        .map(([, snapshot]) => ({
          hallLabel: snapshot.observedHallLabel,
          ordinarySeatCount: snapshot.ordinarySeatCount,
          rowsCount: snapshot.rowsCount,
          observedAt: snapshot.observedAt,
          researchedOnly: true,
          physicallyMeasured: false,
        }))
        .sort((a, b) => a.hallLabel.localeCompare(b.hallLabel, 'zh-TW', { numeric: true }))
      return [slug, halls]
    }),
  )
  return {
    index: {
      researchOnly: true,
      localDeviceOnly: true,
      approvedForPublicUI: false,
      sampledHallLabels: report.sampledHallLabels,
      verifiedHallLabels: report.confirmedDifferentVenueHallLabels,
      missingHallLabels: report.missingFromSample,
      venues,
    },
    getHall(slug, hallLabel) {
      if (!Object.hasOwn(census.venues, slug) || !census.venues[slug].includes(hallLabel)) {
        return null
      }
      return chosen.get(slug + '|' + hallLabel) ?? null
    },
  }
}

export function readPrivateShowtimeCatalogue(root) {
  const research = path.join(root, 'docs/research/theatgood-2026-11-18')
  const downloads = path.join(os.homedir(), 'Downloads', 'TheatGood')
  const census = JSON.parse(
    fs.readFileSync(
      path.join(root, 'scripts/showtime-chrome-extension/operator-public-hall-census.json'),
      'utf8',
    ),
  )
  const archives = fs
    .readdirSync(research)
    .filter((name) => /^showtime_preview_showtime-.*\.json$/.test(name))
    .map((name) => JSON.parse(fs.readFileSync(path.join(research, name), 'utf8')))
  const originalDownloads = fs
    .readdirSync(downloads)
    .filter((name) => /^showtime_sample_showtime-[a-z0-9-]+_[0-9]+\.json$/.test(name))
    .map((filename) => ({ filename, bytes: fs.readFileSync(path.join(downloads, filename)) }))
  const reviews = fs
    .readdirSync(research)
    .filter((name) => /^showtime_conflict_review_.*\.json$/.test(name))
    .map((name) => {
      const review = JSON.parse(fs.readFileSync(path.join(research, name), 'utf8'))
      if (review.cinemaSlug === 'showtime-taipei-xinxin' && review.hallLabel === '1廳') {
        const backup = path.join(
          research,
          'showtime_conflict_backup_showtime-taipei-xinxin_1廳_321_20261122.json',
        )
        assert.equal(sourceDigest(fs.readFileSync(backup)), review.oldArchiveHash)
      }
      return review
    })
  return createShowtimeLocalCatalogue(census, archives, originalDownloads, reviews)
}
