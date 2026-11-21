/**
 * Partition authenticated, per-screening-verified seat-grid research before
 * writing archives. This is an additional provenance guard, not a substitute
 * for the caller's source, venue, hall, seat-label and safety validation.
 *
 * Duplicated geometry across halls may be legitimate, but without independent
 * verification we preserve the original download and quarantine the mapping.
 */
const signature = (seats) =>
  seats
    .map((seat) => seat.label + '@' + seat.gridRow + '/' + seat.gridColumn)
    .sort()
    .join('|')

export function partitionShowtimeHallImports(candidates, archived) {
  const safe = []
  const unchanged = []
  const quarantined = []
  const oldSignatures = archived.map((row) => ({
    ...row,
    geometry: signature(row.snapshot.seatPositions),
  }))
  const newSignatures = candidates.map((row) => ({
    ...row,
    geometry: signature(row.converted.seatPositions),
  }))

  for (const candidate of newSignatures) {
    const oldSameHall = oldSignatures.find((row) => row.filename === candidate.filename)
    const oldOtherHall = oldSignatures.find(
      (row) => row.filename !== candidate.filename && row.geometry === candidate.geometry,
    )
    const newOtherHall = newSignatures.find(
      (row) => row.filename !== candidate.filename && row.geometry === candidate.geometry,
    )

    let reason = null
    let conflictingHall = null
    if (oldSameHall) {
      if (oldSameHall.geometry === candidate.geometry) {
        // A later observation may have different timestamps or source hashes.
        // Preserve its original download without rewriting identical seat geometry.
        unchanged.push({ hallLabel: candidate.hall, existingFilename: oldSameHall.filename })
        continue
      }
      reason = 'existing-hall-grid-changed'
      conflictingHall = oldSameHall.snapshot.observedHallLabel
    } else if (oldOtherHall) {
      reason = 'seat-grid-reused-by-another-archived-hall'
      conflictingHall = oldOtherHall.snapshot.observedHallLabel
    } else if (newOtherHall) {
      reason = 'identical-grid-across-new-halls'
      conflictingHall = newOtherHall.hall
    }

    if (reason) {
      quarantined.push({
        hallLabel: candidate.hall,
        reason,
        conflictingHall,
      })
    } else {
      safe.push({
        filename: candidate.filename,
        hall: candidate.hall,
        converted: candidate.converted,
      })
    }
  }
  return { safe, unchanged, quarantined }
}
