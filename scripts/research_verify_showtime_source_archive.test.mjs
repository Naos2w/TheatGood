import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const script = fileURLToPath(
  new URL('./research_verify_showtime_source_archive.mjs', import.meta.url),
)
const rawName = 'showtime_sample_showtime-taitung_1795006822370.json'
const previewName = 'showtime_preview_showtime-taitung_2廳.json'
const rows = Array.from({ length: 20 }, (_, index) => ({
  label: '1排' + (index + 1) + '號',
  rowLabel: '1',
  seatNumber: index + 1,
  gridRow: 1,
  gridColumn: index + 1,
}))

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'theatgood-showtime-audit-test-'))
  const research = path.join(root, 'research')
  const downloads = path.join(root, 'downloads')
  fs.mkdirSync(research)
  fs.mkdirSync(downloads)
  const raw = {
    researchOnly: true,
    sourceType: 'showtime_authenticated_chrome_extension_read_only',
    cinemaSlug: 'showtime-taitung',
    cinemaName: 'Synthetic Test Cinema',
    venueVerificationMethod: 'exact_venue_plus_hall_on_same_screening_card',
    bookingActionPerformed: false,
    actualSeatClicked: 0,
    checkoutNotOpened: true,
    credentialsRead: false,
    seatAvailabilityRetained: false,
    layouts: [
      {
        hallLabel: '2廳',
        venueMatchedOnIndividualSessionCard: true,
        sourceSessionCinemaName: 'Synthetic Test Cinema',
        sourceEvidence: 'signed_in_operator_preview_with_same_screening_card_venue_verified',
        ordinarySeatCount: 20,
        seatPositions: rows,
      },
    ],
  }
  const bytes = Buffer.from(JSON.stringify(raw), 'utf8')
  fs.writeFileSync(path.join(downloads, rawName), bytes)
  const snap = {
    sourceType: 'showtime_authenticated_chrome_extension_read_only',
    cinemaSlug: 'showtime-taitung',
    observedHallLabel: '2廳',
    observedAt: '2026-11-18T00:00:00Z',
    sourceRawFilename: rawName,
    sourceRawSha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    venueMatchedOnIndividualSessionCard: true,
    venueVerificationMethod: raw.venueVerificationMethod,
    sourceSessionCinemaName: raw.cinemaName,
    sourceEvidence: raw.layouts[0].sourceEvidence,
    physicalHallIdentityStatus: 'operator_screening_card_venue_and_hall_verified_not_surveyed',
    ordinarySeatCount: rows.length,
    seatPositions: rows,
    selectedSeats: 0,
    bookingActionPerformed: false,
    soldOrAvailableStateRetained: false,
    operatorImageCopied: false,
  }
  const write = () => fs.writeFileSync(path.join(research, previewName), JSON.stringify(snap))
  write()
  const run = () => {
    const result = spawnSync(process.execPath, [script, research, downloads], {
      encoding: 'utf8',
      timeout: 8000,
    })
    assert.equal(result.error, undefined)
    return { ...result, report: JSON.parse(result.stdout) }
  }
  return { root, research, downloads, raw, snap, write, run }
}

test('accepts immutable same-card source and only reports metadata, never raw seat positions', () => {
  const f = fixture()
  try {
    const { status, stdout, report } = f.run()
    assert.equal(status, 0)
    assert.equal(report.confirmedSameCardGrids, 1)
    assert.equal(report.confirmedSameCardSeats, 20)
    assert.equal(report.rawDownloadsHashVerified, 1)
    assert.equal(report.errors.length, 0)
    assert.equal(report.approvedForPublicUI, false)
    assert(!stdout.includes('1排1號'))
    assert(!stdout.includes('gridColumn'))
  } finally {
    fs.rmSync(f.root, { recursive: true, force: true })
  }
})

test('rejects both altered original bytes and changed grid cells', () => {
  const f = fixture()
  try {
    const modified = { ...f.raw, notes: 'tampered after import' }
    fs.writeFileSync(path.join(f.downloads, rawName), JSON.stringify(modified))
    const badOriginal = f.run()
    assert.equal(badOriginal.status, 1)
    assert.match(badOriginal.report.errors[0].reason, /SHA256 mismatch/)
    fs.writeFileSync(path.join(f.downloads, rawName), JSON.stringify(f.raw))
    f.snap.seatPositions = structuredClone(rows)
    f.snap.seatPositions[0].gridColumn = 99
    f.write()
    const badGrid = f.run()
    assert.equal(badGrid.status, 1)
    assert.equal(badGrid.report.confirmedSameCardGrids, 0)
  } finally {
    fs.rmSync(f.root, { recursive: true, force: true })
  }
})

test('legacy venue-unconfirmed grids remain research-only without requiring a download', () => {
  const f = fixture()
  try {
    const old = {
      sourceType: 'authorised_authenticated_operator_ui_seat_preview',
      cinemaSlug: 'showtime-taitung',
      ordinarySeatCount: 20,
    }
    fs.writeFileSync(path.join(f.research, previewName), JSON.stringify(old))
    fs.unlinkSync(path.join(f.downloads, rawName))
    const { status, report } = f.run()
    assert.equal(status, 0)
    assert.equal(report.confirmedSameCardGrids, 0)
    assert.equal(report.legacyResearchOnlyGrids, 1)
    assert.equal(report.legacyResearchOnlySeats, 20)
  } finally {
    fs.rmSync(f.root, { recursive: true, force: true })
  }
})
