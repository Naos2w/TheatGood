import assert from 'node:assert/strict'
import test from 'node:test'
import { partitionShowtimeHallImports } from './research_showtime_import_partition.mjs'

const seats = (suffix = 0) => [
  { label: 'A排1號', gridRow: 1, gridColumn: 1 + suffix },
  { label: 'A排2號', gridRow: 1, gridColumn: 2 + suffix },
]

function candidate(hall, data = seats()) {
  return {
    hall,
    filename: 'showtime_preview_showtime-test_' + hall + '.json',
    converted: { observedHallLabel: hall, seatPositions: data, sourceRawSha256: 'new-source' },
  }
}

function archive(row) {
  return { filename: row.filename, snapshot: row.converted }
}

test('new unique hall is importable without changing data', () => {
  const row = candidate('1廳')
  const result = partitionShowtimeHallImports([row], [])
  assert.deepEqual(result.quarantined, [])
  assert.deepEqual(result.unchanged, [])
  assert.deepEqual(result.safe, [row])
})

test('same grid as another archived hall is quarantined, not silently accepted', () => {
  const row = candidate('6廳')
  const prior = candidate('3廳')
  const result = partitionShowtimeHallImports([row], [archive(prior)])
  assert.equal(result.safe.length, 0)
  assert.deepEqual(result.quarantined, [
    {
      hallLabel: '6廳',
      reason: 'seat-grid-reused-by-another-archived-hall',
      conflictingHall: '3廳',
    },
  ])
})

test('a changed seat grid for an existing hall does not overwrite the archive', () => {
  const row = candidate('丹普廳', seats(1))
  const old = candidate('丹普廳')
  const result = partitionShowtimeHallImports([row], [archive(old)])
  assert.equal(result.safe.length, 0)
  assert.equal(result.quarantined[0].reason, 'existing-hall-grid-changed')
})

test('the same hall geometry is not rewritten when provenance metadata changes', () => {
  const row = candidate('2廳')
  const prior = candidate('2廳')
  prior.converted.sourceRawSha256 = 'prior-source'
  const result = partitionShowtimeHallImports([row], [archive(prior)])
  assert.deepEqual(result.safe, [])
  assert.deepEqual(result.quarantined, [])
  assert.deepEqual(result.unchanged, [{ hallLabel: '2廳', existingFilename: prior.filename }])
})

test('a duplicate layout in two new halls quarantines both, never picks a winner', () => {
  const result = partitionShowtimeHallImports([candidate('2廳'), candidate('5廳')], [])
  assert.equal(result.safe.length, 0)
  assert.deepEqual(
    result.quarantined.map((x) => x.reason),
    ['identical-grid-across-new-halls', 'identical-grid-across-new-halls'],
  )
})

test('other unambiguous halls are retained when a conflict is quarantined', () => {
  const result = partitionShowtimeHallImports(
    [candidate('1廳'), candidate('6廳', seats(1))],
    [archive(candidate('3廳', seats(1)))],
  )
  assert.deepEqual(
    result.safe.map((row) => row.hall),
    ['1廳'],
  )
  assert.deepEqual(
    result.quarantined.map((row) => row.hallLabel),
    ['6廳'],
  )
})
