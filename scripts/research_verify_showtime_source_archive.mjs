/**
 * Read-only verification of previously authorised Showtime seat-grid evidence.
 *
 * Usage:
 *   node scripts/research_verify_showtime_source_archive.mjs <research-dir> <downloads-dir>
 *
 * Never opens a browser, signs in, books tickets, uploads source grids, copies
 * raw downloads, or touches the application's public assets / database.
 * Emits sanitised counts and per-hall identity only, not seat coordinates,
 * ticket/availability state, personal data or raw file content.
 */
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import console from 'node:console'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const [researchArg, downloadsArg] = process.argv.slice(2)
assert(researchArg && downloadsArg, 'Provide research and dedicated downloads directories')
const research = path.resolve(researchArg)
const downloads = path.resolve(downloadsArg)
assert(fs.statSync(research).isDirectory() && fs.statSync(downloads).isDirectory())
const files = fs
  .readdirSync(research)
  .filter((f) => /^showtime_preview_showtime-[a-z0-9-]+_.+\.json$/.test(f))
  .sort()
const approvedSourceType = 'showtime_authenticated_chrome_extension_read_only'
const sourceEvidence = 'signed_in_operator_preview_with_same_screening_card_venue_verified'
const expectedIdentity = 'operator_screening_card_venue_and_hall_verified_not_surveyed'
const sameCardMethod = 'exact_venue_plus_hall_on_same_screening_card'

const signature = (positions) =>
  positions
    .map((seat) => String(seat.label) + '@' + seat.gridRow + '/' + seat.gridColumn)
    .sort()
    .join('|')
const rawCache = new Map()
const errors = []
const verified = []
let legacyLayouts = 0
let legacySeatCount = 0

for (const file of files) {
  const snap = JSON.parse(fs.readFileSync(path.join(research, file), 'utf8'))
  if (snap.sourceType !== approvedSourceType) {
    legacyLayouts += 1
    legacySeatCount += snap.ordinarySeatCount ?? 0
    continue
  }
  try {
    assert.equal(snap.sourceEvidence, sourceEvidence)
    assert.equal(snap.physicalHallIdentityStatus, expectedIdentity)
    assert.equal(snap.venueMatchedOnIndividualSessionCard, true)
    assert.equal(snap.venueVerificationMethod, sameCardMethod)
    assert.equal(snap.selectedSeats, 0)
    assert.equal(snap.bookingActionPerformed, false)
    assert.equal(snap.soldOrAvailableStateRetained, false)
    assert.equal(snap.operatorImageCopied, false)
    assert(/^showtime_sample_showtime-[a-z0-9-]+_[0-9]+\.json$/.test(snap.sourceRawFilename))
    assert(/^[a-f0-9]{64}$/.test(snap.sourceRawSha256))
    assert.equal(snap.ordinarySeatCount, snap.seatPositions.length)
    assert(file.startsWith('showtime_preview_' + snap.cinemaSlug + '_'))

    let raw = rawCache.get(snap.sourceRawFilename)
    if (!raw) {
      const bytes = fs.readFileSync(path.join(downloads, snap.sourceRawFilename))
      const sha = crypto.createHash('sha256').update(bytes).digest('hex')
      assert.equal(sha, snap.sourceRawSha256, 'Original download SHA256 mismatch')
      raw = JSON.parse(bytes.toString('utf8'))
      assert.equal(raw.researchOnly, true)
      assert.equal(raw.sourceType, approvedSourceType)
      assert.equal(raw.cinemaSlug, snap.cinemaSlug)
      assert.equal(raw.cinemaName, snap.sourceSessionCinemaName)
      assert.equal(raw.venueVerificationMethod, sameCardMethod)
      assert.equal(raw.bookingActionPerformed, false)
      assert.equal(raw.actualSeatClicked, 0)
      assert.equal(raw.checkoutNotOpened, true)
      assert.equal(raw.credentialsRead, false)
      assert.equal(raw.seatAvailabilityRetained, false)
      assert(Array.isArray(raw.layouts))
      rawCache.set(snap.sourceRawFilename, raw)
    }
    const original = raw.layouts.find((layout) => layout.hallLabel === snap.observedHallLabel)
    assert(original, 'Hall not present in original signed-in research download')
    assert.equal(original.venueMatchedOnIndividualSessionCard, true)
    assert.equal(original.sourceSessionCinemaName, snap.sourceSessionCinemaName)
    assert.equal(original.sourceEvidence, sourceEvidence)
    assert.equal(original.ordinarySeatCount, snap.ordinarySeatCount)
    assert.equal(original.seatPositions.length, snap.seatPositions.length)
    assert.equal(signature(original.seatPositions), signature(snap.seatPositions))
    assert.equal(new Set(snap.seatPositions.map((s) => s.label)).size, snap.ordinarySeatCount)
    assert.equal(
      new Set(snap.seatPositions.map((s) => s.gridRow + '/' + s.gridColumn)).size,
      snap.ordinarySeatCount,
    )
    verified.push({
      cinemaSlug: snap.cinemaSlug,
      hallLabel: snap.observedHallLabel,
      seatCount: snap.ordinarySeatCount,
      observedAt: snap.observedAt,
      rawSourceSha256: snap.sourceRawSha256,
      sameCardIdentityVerified: true,
      physicalGeometryMeasured: false,
    })
  } catch (error) {
    errors.push({
      cinemaSlug: String(snap.cinemaSlug ?? ''),
      hallLabel: String(snap.observedHallLabel ?? ''),
      reason: error instanceof Error ? error.message : 'Unknown integrity error',
    })
  }
}
const all = verified.length + legacyLayouts + errors.length
const report = {
  auditDate: '2026-11-20',
  researchOnly: true,
  approvedForPublicUI: false,
  originalResearchFilesChanged: false,
  authenticatedBrowserAccessed: false,
  originalDownloadFilesCopied: false,
  totalSnapshots: files.length,
  totalClassified: all,
  rawDownloadsHashVerified: rawCache.size,
  confirmedSameCardGrids: verified.length,
  confirmedSameCardSeats: verified.reduce((a, b) => a + b.seatCount, 0),
  confirmedSameCardVenues: [...new Set(verified.map((x) => x.cinemaSlug))].length,
  legacyResearchOnlyGrids: legacyLayouts,
  legacyResearchOnlySeats: legacySeatCount,
  errors,
  verified,
}
// Emit ASCII-only JSON for Windows PowerShell pipes without changing the
// underlying source bytes (including UTF-8 seat labels) being compared.
const json = JSON.stringify(report, null, 2)
let ascii = ''
for (let index = 0; index < json.length; index++) {
  const code = json.charCodeAt(index)
  ascii += code > 127 ? '\\u' + code.toString(16).padStart(4, '0') : json[index]
}
console.log(ascii)
if (errors.length || all !== files.length) process.exitCode = 1
