import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { Buffer } from 'node:buffer'
import fs from 'node:fs'
import test from 'node:test'
import { URL, fileURLToPath } from 'node:url'
import { createShowtimeLocalCatalogue } from './showtime-local-catalogue.mjs'
import {
  isLocalResearchRequest,
  privateShowtimeDevPlugin,
} from './vite-private-showtime-preview.mjs'

const census = JSON.parse(
  fs.readFileSync(
    fileURLToPath(
      new URL('./showtime-chrome-extension/operator-public-hall-census.json', import.meta.url),
    ),
    'utf8',
  ),
)
const SOURCE = 'showtime_authenticated_chrome_extension_read_only'

function fakeSnapshot() {
  const slug = 'showtime-taitung'
  const title = '台東秀泰影城'
  const seats = Array.from({ length: 20 }, (_, i) => ({
    label: 'A排' + (i + 1) + '號',
    rowLabel: 'A',
    seatNumber: i + 1,
    gridRow: 1,
    gridColumn: i + 1,
  }))
  const source = {
    sourceType: SOURCE,
    researchOnly: true,
    cinemaSlug: slug,
    cinemaName: title,
    venueVerificationMethod: 'exact_venue_plus_hall_on_same_screening_card',
    sourceUrl: 'https://showtimes.com.tw/',
    bookingActionPerformed: false,
    actualSeatClicked: 0,
    checkoutNotOpened: true,
    credentialsRead: false,
    seatAvailabilityRetained: false,
    sampledAt: '2026-11-21T15:05:00Z',
    layouts: [
      {
        hallLabel: '1廳',
        ordinarySeatCount: seats.length,
        rowsCount: 1,
        seatPositions: seats,
        screenWidthM: null,
        screenHeightM: null,
        wheelchairLayoutVerified: false,
        venueMatchedOnIndividualSessionCard: true,
        sourceSessionCinemaName: title,
        sourceEvidence: 'signed_in_operator_preview_with_same_screening_card_venue_verified',
      },
    ],
  }
  return {
    filename: 'showtime_sample_showtime-taitung_1795273500000.json',
    bytes: Buffer.from(JSON.stringify(source)),
  }
}

test('private catalogue derives only verified same-card halls without storing member details', () => {
  const raw = fakeSnapshot()
  const catalogue = createShowtimeLocalCatalogue(census, [], [raw])
  assert.equal(catalogue.index.verifiedHallLabels, 1)
  assert.equal(catalogue.index.localDeviceOnly, true)
  assert.equal(catalogue.index.approvedForPublicUI, false)
  assert.equal(catalogue.index.venues['showtime-taitung'].length, 1)
  const hall = catalogue.getHall('showtime-taitung', '1廳')
  assert.equal(hall.ordinarySeatCount, 20)
  assert.equal(hall.seatPositions[3].label, 'A排4號')
  assert.equal(hall.sourceRawSha256, crypto.createHash('sha256').update(raw.bytes).digest('hex'))
  assert.equal(hall.bookingActionPerformed, false)
  assert.equal(hall.selectedSeats, 0)
  assert.equal(hall.screenWidthM, undefined)
  assert.equal(hall.cookie, undefined)
  assert.equal(catalogue.getHall('showtime-taitung', '2廳'), null)
  assert.equal(catalogue.getHall('../secrets', '1廳'), null)
})

test('a conflicting operator source blocks all private previews until reviewed', () => {
  const raw = fakeSnapshot()
  const altered = JSON.parse(raw.bytes.toString('utf8'))
  altered.layouts[0].seatPositions[0].gridColumn = 22
  const second = {
    filename: 'showtime_sample_showtime-taitung_1795273500001.json',
    bytes: Buffer.from(JSON.stringify(altered)),
  }
  assert.throws(
    () => createShowtimeLocalCatalogue(census, [], [raw, second]),
    /unresolved seat-grid conflicts/,
  )
})

test('private middleware refuses remote clients and cross-origin reads before accessing files', () => {
  const localhost = {
    socket: { remoteAddress: '127.0.0.1' },
    headers: { host: '127.0.0.1:5173', origin: 'http://127.0.0.1:5173' },
  }
  assert.equal(isLocalResearchRequest(localhost), true)
  assert.equal(
    isLocalResearchRequest({
      ...localhost,
      socket: { remoteAddress: '::ffff:127.0.0.1' },
    }),
    true,
  )
  assert.equal(
    isLocalResearchRequest({ ...localhost, socket: { remoteAddress: '100.86.42.17' } }),
    false,
  )
  assert.equal(
    isLocalResearchRequest({ ...localhost, headers: { host: 'msi-win.tailcca2df.ts.net' } }),
    false,
  )
  assert.equal(
    isLocalResearchRequest({
      ...localhost,
      headers: { ...localhost.headers, origin: 'https://attacker.example' },
    }),
    false,
  )
  assert.equal(
    isLocalResearchRequest({
      ...localhost,
      headers: { ...localhost.headers, 'sec-fetch-site': 'cross-site' },
    }),
    false,
  )
  assert.equal(
    isLocalResearchRequest({ ...localhost, headers: { host: '127.0.0.1.attacker.example' } }),
    false,
  )

  let handler
  const plugin = privateShowtimeDevPlugin('/nonexistent-private-fixtures')
  assert.equal(plugin.apply, 'serve')
  plugin.configureServer({
    middlewares: {
      use: (fn) => {
        handler = fn
      },
    },
  })
  const response = () => ({
    statusCode: 0,
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value
    },
    end(value) {
      this.body = JSON.parse(value)
    },
  })
  const rejected = response()
  handler(
    {
      ...localhost,
      socket: { remoteAddress: '192.168.1.8' },
      method: 'GET',
      url: '/__theatgood_private/showtime/index',
    },
    rejected,
    () => assert.fail('Must not fall through'),
  )
  assert.equal(rejected.statusCode, 403)
  assert.equal(rejected.body.error, 'local-only-research-preview')
  const missing = response()
  handler(
    { ...localhost, method: 'GET', url: '/__theatgood_private/showtime/index' },
    missing,
    () => assert.fail('Must not fall through'),
  )
  assert.equal(missing.statusCode, 503)
})
