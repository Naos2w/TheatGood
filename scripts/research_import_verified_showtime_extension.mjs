/**
 * Safely import only source-verified Showtime seat PREVIEW research snapshots.
 *
 * The input must be the user's local, downloaded v0.1.3+ extension JSON:
 *  - exact cinema+hall label was read from each individual screening card;
 *  - selected seats/orders/credentials are explicitly absent;
 *  - observed hall exists in the corresponding public operator census;
 *  - duplicate seats and coordinates are not permitted;
 *  - historical operator snapshots are never overwritten;
 *  - cross-cinema geometry identity is a stop condition for review.
 *
 * The script changes ONLY research data under docs/research. No App, DB,
 * user browser session, booking website, payments or production release.
 *
 * node scripts/research_import_verified_showtime_extension.mjs <absolute-path>
 * node scripts/research_import_verified_showtime_extension.mjs <absolute-path> --quarantine-conflicts --dry-run
 * node scripts/research_import_verified_showtime_extension.mjs <absolute-path> --quarantine-conflicts
 *
 * Without --quarantine-conflicts, any changed historical grid or duplicate
 * cross-hall geometry blocks the entire batch. The opt-in mode validates every
 * source entry, archives the original SHA, but writes only non-conflicting new
 * hall snapshots; conflicts are recorded for later manual review.
 */
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import console from 'node:console'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { URL, fileURLToPath } from 'node:url'
import { partitionShowtimeHallImports } from './research_showtime_import_partition.mjs'

const repo = fileURLToPath(new URL('../', import.meta.url))
const destination = path.join(repo, 'docs/research/theatgood-2026-11-18')
const input = process.argv[2]
const options = process.argv.slice(3)
assert(options.every((arg) => ['--quarantine-conflicts', '--dry-run'].includes(arg)))
assert(new Set(options).size === options.length, 'Duplicate import option')
const allowQuarantine = options.includes('--quarantine-conflicts')
const dryRun = options.includes('--dry-run')
assert(
  input && path.isAbsolute(input) && fs.existsSync(input),
  'Pass an existing absolute downloaded Showtime JSON path',
)
const sourceName = path.basename(input)
// Only these two verbatim messages are emitted by the extension when its
// cooperative scan deadline prevents additional previews.
const isSafetyDeadlineWarning = (error) =>
  error === '本輪已達安全時間上限，其他場次未讀取' ||
  error === '本輪已達安全時間上限，未再開啟其他場次'
const nameMatch = /^showtime_sample_(showtime-[a-z0-9-]+)_(\d+)\.json$/.exec(sourceName)
assert(nameMatch, 'Unknown research sample filename')
const [, slug, timestamp] = nameMatch
const raw = fs.readFileSync(input)
assert(raw.byteLength > 100 && raw.byteLength < 2_000_000, 'Invalid source size')
const source = JSON.parse(raw.toString('utf8'))
const sha256 = crypto.createHash('sha256').update(raw).digest('hex')
assert(source.cinemaSlug === slug, 'Source cinema ID does not match filename')
assert(source.cinemaName && typeof source.cinemaName === 'string')
assert(
  source.researchOnly === true &&
    source.sourceType === 'showtime_authenticated_chrome_extension_read_only',
)
assert(source.venueVerificationMethod === 'exact_venue_plus_hall_on_same_screening_card')
assert(source.bookingActionPerformed === false && source.actualSeatClicked === 0)
assert(source.checkoutNotOpened === true && source.credentialsRead === false)
assert(source.seatAvailabilityRetained === false)
assert(
  ['https://www.showtimes.com.tw/', 'https://showtimes.com.tw/'].includes(source.sourceUrl),
  'Showtime source must match one of two exact official HTTPS hosts',
)
assert(Number.isInteger(source.movieCardsChecked) && source.movieCardsChecked >= 1)
assert(Number.isInteger(source.seatPreviewModalsOpened) && source.seatPreviewModalsOpened >= 1)
assert(typeof source.sampledAt === 'string' && Number.isFinite(Date.parse(source.sampledAt)))
assert(Array.isArray(source.errors))
assert(
  source.errors.every((error) => {
    if (typeof error !== 'string' || error.includes('密碼')) return false
    // Known source-mismatch skips are allowed only for this exact venue.
    if (/^已略過其他分館或缺少明確「[^」]+ 廳號」的場次；未讀取座位$/.test(error)) {
      return error.includes('「' + source.cinemaName + ' 廳號」')
    }
    // A later film page timed out; earlier individually verified hall grids
    // remain usable, but the skipped film is documented as incomplete.
    if (/^第[1-9][0-9]*部電影：Error: 頁面內容逾時或需要重新驗證$/.test(error)) {
      return true
    }
    // The extension's explicit per-run safety limit stops subsequent
    // screenings; earlier source-verified halls may still be imported.
    if (isSafetyDeadlineWarning(error)) {
      return true
    }
    return false
  }),
  'Unexpected source errors require review rather than silent import',
)
assert(Array.isArray(source.layouts) && source.layouts.length >= 1 && source.layouts.length <= 35)

const census = JSON.parse(
  fs.readFileSync(
    path.join(repo, 'scripts/showtime-chrome-extension/operator-public-hall-census.json'),
    'utf8',
  ),
)
const officialLabels = new Set(census.venues?.[slug] ?? [])
assert(officialLabels.size > 0, 'No matching public operator hall-name evidence')

const otherFiles = fs
  .readdirSync(destination)
  .filter((name) => /^showtime_preview_showtime-.*\.json$/.test(name))
const existing = otherFiles.map((name) => ({
  filename: name,
  snapshot: JSON.parse(fs.readFileSync(path.join(destination, name), 'utf8')),
}))
const candidates = []
const seen = new Set()
for (const entry of source.layouts) {
  const hall = entry.hallLabel
  assert(
    typeof hall === 'string' && /^(?:\d+館)?(?:第?\d+|巨幕\d+|丹普|[A-Za-z0-9 ]+)廳$/.test(hall),
  )
  assert(!seen.has(hall), 'Duplicate hall in batch: ' + hall)
  seen.add(hall)
  assert(officialLabels.has(hall), 'Hall not in target venue public source census: ' + hall)
  assert(
    entry.sourceSessionCinemaName === source.cinemaName,
    'Per-screening venue identity does not match source selection',
  )
  assert(
    entry.venueMatchedOnIndividualSessionCard === true,
    'Per-screening venue identity not verified',
  )
  assert(
    entry.sourceEvidence === 'signed_in_operator_preview_with_same_screening_card_venue_verified',
  )
  assert(entry.geometryUnits === 'relative_css_grid_not_metres')
  assert(entry.screenWidthM === null && entry.screenHeightM === null)
  assert(entry.rowPitchM === null && entry.seatPitchM === null)
  assert(entry.wheelchairLayoutVerified === false)
  const seats = entry.seatPositions
  assert(
    Number.isInteger(entry.ordinarySeatCount) &&
      entry.ordinarySeatCount >= 20 &&
      entry.ordinarySeatCount <= 1000,
  )
  assert(Array.isArray(seats) && seats.length === entry.ordinarySeatCount)
  assert(Number.isInteger(entry.rowsCount) && entry.rowsCount >= 1 && entry.rowsCount <= 40)
  const labels = new Set()
  const coordinates = new Set()
  for (const seat of seats) {
    assert(seat && typeof seat.label === 'string' && /^([A-Z]+|\d+)排\d+號$/.test(seat.label))
    assert(seat.label === seat.rowLabel + '排' + seat.seatNumber + '號')
    assert(Number.isInteger(seat.seatNumber) && seat.seatNumber > 0)
    assert(Number.isInteger(seat.gridRow) && seat.gridRow > 0 && seat.gridRow < 100)
    assert(Number.isInteger(seat.gridColumn) && seat.gridColumn > 0 && seat.gridColumn < 100)
    const coordinate = seat.gridRow + '/' + seat.gridColumn
    assert(!labels.has(seat.label), 'Repeated seat label in ' + hall)
    assert(!coordinates.has(coordinate), 'Repeated seat location in ' + hall)
    labels.add(seat.label)
    coordinates.add(coordinate)
  }
  assert(new Set(seats.map((seat) => seat.rowLabel)).size === entry.rowsCount)
  const filename = 'showtime_preview_' + slug + '_' + hall + '.json'
  const converted = {
    sourceType: 'showtime_authenticated_chrome_extension_read_only',
    operator: 'Showtimes Cinemas',
    cinemaSlug: slug,
    sourceSessionCinemaName: source.cinemaName,
    venueMatchedOnIndividualSessionCard: true,
    venueVerificationMethod: source.venueVerificationMethod,
    observedHallLabel: hall,
    observedAt: source.sampledAt,
    captureMethod: 'chrome_extension_0.1.3_existing_signed_in_tab_read_only_dom',
    sourceLandingUrl: source.sourceUrl,
    sourceRawFilename: sourceName,
    sourceRawSha256: sha256,
    sourceEvidence: entry.sourceEvidence,
    physicalHallIdentityStatus: 'operator_screening_card_venue_and_hall_verified_not_surveyed',
    seatGridEvidence: 'operator_read_only_seat_preview',
    relativeGridUnit: 'operator_css_layout_cells_not_metres',
    ordinarySeatCount: entry.ordinarySeatCount,
    rowsCount: entry.rowsCount,
    seatPositions: seats,
    screenWidthM: null,
    screenHeightM: null,
    rowPitchM: null,
    seatPitchM: null,
    inclineDegrees: null,
    wheelchairLayoutVerified: false,
    selectedSeats: 0,
    bookingActionPerformed: false,
    soldOrAvailableStateRetained: false,
    operatorImageCopied: false,
    caveat:
      'Official operator same-screening-card cinema+hall matched; relative UI seat grid, NOT surveyed metres. Venue identity is from extension DOM evidence; permanent hall identity, screen size, slope and wheelchair coordinates need independent evidence.',
  }
  candidates.push({ filename, converted, hall })
}
const { safe: batches, unchanged, quarantined } = partitionShowtimeHallImports(candidates, existing)
assert(
  allowQuarantine || quarantined.length === 0,
  'Conflicting hall identity or seat-grid signature requires review: ' +
    JSON.stringify(quarantined),
)
// All evidence is validated BEFORE performing any writes.
const rawFilename = 'showtime_extension_verified_raw_' + slug + '_' + timestamp + '.json'
const auditFilename = 'showtime_extension_verified_audit_' + slug + '_' + timestamp + '.json'
const expectedOutputs = [rawFilename, auditFilename, ...batches.map((row) => row.filename)]
for (const filename of expectedOutputs) {
  assert(!filename.includes('/') && !filename.includes('\\'))
  if (filename === auditFilename) continue
  const file = path.join(destination, filename)
  if (fs.existsSync(file) && filename === rawFilename) {
    assert(fs.readFileSync(file).equals(raw), 'Conflicting existing raw research snapshot')
  }
  if (fs.existsSync(file) && filename !== rawFilename) {
    assert(
      fs.readFileSync(file, 'utf8') ===
        JSON.stringify(batches.find((row) => row.filename === filename).converted, null, 2) + '\n',
      'Refuse to overwrite an existing hall research snapshot: ' + filename,
    )
  }
}
const audit = {
  sourceName,
  sourceSha256: sha256,
  sourceCinemaName: source.cinemaName,
  cinemaSlug: slug,
  sourceSampledAt: source.sampledAt,
  sourceMemberReadOnly: true,
  sourceIndividualScreeningVenueVerification: true,
  sourceErrorCount: source.errors.length,
  sourceSkippedForeignOrUnprovenScreenings: source.errors.filter((error) =>
    error.startsWith('已略過其他分館'),
  ).length,
  sourceTimedOutScreenings: source.errors.filter((error) =>
    /^第[1-9][0-9]*部電影：Error: 頁面內容逾時或需要重新驗證$/.test(error),
  ).length,
  sourceReachedSafetyTimeLimit: source.errors.some(isSafetyDeadlineWarning),
  sourceRunPartiallyIncomplete: source.errors.some(
    (error) =>
      /^第[1-9][0-9]*部電影：Error: 頁面內容逾時或需要重新驗證$/.test(error) ||
      isSafetyDeadlineWarning(error),
  ),
  movieCardsChecked: source.movieCardsChecked,
  sourcePreviewsOpened: source.seatPreviewModalsOpened,
  rawResearchFilename: rawFilename,
  sourceTotalHallCount: candidates.length,
  quarantineEnabled: allowQuarantine,
  quarantinedHallCount: quarantined.length,
  quarantinedHalls: quarantined,
  unchangedHallCount: unchanged.length,
  unchangedHalls: unchanged,
  sourceRunPartiallyImported: quarantined.length > 0,
  importedHallCount: batches.length,
  importedRelativeSeatLabels: batches.reduce(
    (count, row) => count + row.converted.ordinarySeatCount,
    0,
  ),
  addedToResearch: batches.length > 0,
  importedIntoProductionUI: false,
  bookingActions: 0,
  selectedSeats: 0,
  sourceType: source.sourceType,
  note: 'Authenticated operator read-only preview research with each venue+hall verified on the same screening card; prior cross-venue mistaken download remains separately quarantined and excluded. No physical hall measurements or production 3D import.',
  halls: batches.map((row) => ({
    hallLabel: row.hall,
    ordinarySeatCount: row.converted.ordinarySeatCount,
    normalizedFilename: row.filename,
    physicalScreenMetresVerified: false,
  })),
}
const auditPath = path.join(destination, auditFilename)
if (fs.existsSync(auditPath)) {
  assert(
    fs.readFileSync(auditPath, 'utf8') === JSON.stringify(audit, null, 2) + '\n',
    'Refuse to overwrite a different existing source audit',
  )
}
if (dryRun) {
  console.log(
    JSON.stringify({
      dryRun: true,
      cinema: slug,
      sourceSha256: sha256,
      importableHalls: batches.map((row) => row.hall),
      unchangedHalls: unchanged,
      quarantinedHalls: quarantined,
      existingFilesUnchanged: true,
    }),
  )
  process.exit(0)
}
if (!fs.existsSync(path.join(destination, rawFilename))) {
  fs.copyFileSync(input, path.join(destination, rawFilename), fs.constants.COPYFILE_EXCL)
}
for (const row of batches) {
  const out = path.join(destination, row.filename)
  if (!fs.existsSync(out))
    fs.writeFileSync(out, JSON.stringify(row.converted, null, 2) + '\n', { flag: 'wx' })
}
if (!fs.existsSync(auditPath))
  fs.writeFileSync(auditPath, JSON.stringify(audit, null, 2) + '\n', { flag: 'wx' })
console.log(
  JSON.stringify({
    sourceSha256: sha256,
    cinema: slug,
    addedResearchHalls: batches.length,
    addedResearchSeatLabels: audit.importedRelativeSeatLabels,
    skippedOtherVenueScreenings: audit.sourceSkippedForeignOrUnprovenScreenings,
    hallLabels: batches.map((row) => row.hall),
    unchangedHalls: unchanged,
    quarantinedHalls: quarantined,
    rawFilename,
    auditFilename,
    productUIChanges: 0,
  }),
)
