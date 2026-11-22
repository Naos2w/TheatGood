/**
 * Private, read-only, source-to-3D coverage audit for the authorised MSI owner.
 *
 * Run: npx tsx scripts/research_verify_showtime_3d_scenes.mjs
 * Never copy member seat grids into the public repo, build, or CI fixtures.
 * Prints aggregate counts only; does not access tickets, booking or cookies.
 */
import assert from 'node:assert/strict'
import console from 'node:console'
import { URL, fileURLToPath } from 'node:url'
import { readPrivateShowtimeCatalogue } from './showtime-local-catalogue.mjs'
import { deriveShowtimeEstimatedScene } from '../src/features/viewer/showtime-estimated-scene.ts'
import { chainCinemas } from '../src/features/cinemas/chain-directory.ts'

const root = fileURLToPath(new URL('../', import.meta.url))
const { index, getHall } = readPrivateShowtimeCatalogue(root)
const venueSlugs = new Set(
  chainCinemas.filter((cinema) => cinema.brand === 'showtime').map((cinema) => cinema.slug),
)

assert.equal(index.researchOnly, true)
assert.equal(index.localDeviceOnly, true)
assert.equal(index.approvedForPublicUI, false)
assert.equal(Object.keys(index.venues).length, venueSlugs.size)
assert.equal(index.sampledHallLabels, index.verifiedHallLabels + index.missingHallLabels)

let scenes = 0
let seats = 0
for (const [slug, halls] of Object.entries(index.venues)) {
  assert(venueSlugs.has(slug), 'Unexpected source venue')
  const hallLabels = new Set()
  for (const hall of halls) {
    assert(!hallLabels.has(hall.hallLabel), 'Duplicate source hall')
    hallLabels.add(hall.hallLabel)
    const source = getHall(slug, hall.hallLabel)
    assert(source, 'An indexed hall has no verified seat grid')
    const scene = deriveShowtimeEstimatedScene(source, undefined, slug)
    assert.equal(scene.eligibleForPreview, true)
    assert.equal(scene.evidence, 'same-card-venue-and-hall')
    assert.equal(scene.geometryMeasured, false)
    assert.equal(scene.screenDimensionsProvenance, 'estimated')
    assert.equal(scene.venueClaimUsedAsHallMeasurement, false)
    assert.equal(scene.cinemaSlug, slug)
    assert.equal(scene.hallLabel, hall.hallLabel)
    assert.equal(scene.seats.length, hall.ordinarySeatCount)
    assert.equal(scene.auditorium.rows.length, hall.rowsCount)
    assert.deepEqual(
      scene.seats.map((seat) => seat.id),
      source.seatPositions.map((seat) => seat.label),
      '3D seat IDs must exactly preserve the operator layout',
    )
    assert.equal(new Set(scene.seats.map((seat) => seat.id)).size, scene.seats.length)
    assert.equal(
      new Set(scene.seats.map((seat) => seat.x.toFixed(5) + '/' + seat.z.toFixed(5))).size,
      scene.seats.length,
      '3D must not overlap two sourced seats',
    )
    assert(
      scene.seats.every((seat) =>
        [seat.x, seat.z, seat.eyeY, seat.elevation].every(Number.isFinite),
      ),
      'All 3D seat positions must be finite',
    )
    assert(scene.auditorium.screen.width > 0 && scene.auditorium.screen.height > 0)
    assert.deepEqual(scene.wheelchairSpots, [], 'Unknown wheelchair positions must stay unknown')
    scenes++
    seats += scene.seats.length
  }
}

assert.equal(scenes, index.verifiedHallLabels, 'Not every verified hall has a 3D scene')
console.log(
  JSON.stringify({
    status: 'verified',
    chain: 'showtime',
    venues: venueSlugs.size,
    sampledHallLabels: index.sampledHallLabels,
    sourceBacked3DScenes: scenes,
    sourceBackedSeatLabels: seats,
    remainingWithoutVerifiedGrid: index.missingHallLabels,
    exactSeatIdsPreserved: true,
    publishedMemberSeatData: false,
  }),
)
