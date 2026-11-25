import { describe, expect, it } from 'vitest'
import {
  auditOperatorSeatGridCandidate,
  pendingChainSeatSourceWorklist,
  type OperatorSeatGridCandidate,
} from './chain-seat-evidence'

const sample: OperatorSeatGridCandidate = {
  brand: 'ambassador',
  cinemaSlug: 'ambassador-taipei-ximenting',
  hallLabel: '2 廳',
  sourceCinemaSlug: 'ambassador-taipei-ximenting',
  sourceHallLabel: '2廳',
  sourceUrl: 'https://www.ambassador.com.tw/home/theater_intro_b1',
  observedAt: '2026-11-23T01:00:00+08:00',
  sourceMethod: 'public-operator-grid',
  hallIdentification: 'official-numbered-seat-diagram',
  completeGrid: true,
  // Synthetic unit-test positions: NOT a real Ambassador seating plan.
  seatPositions: Array.from({ length: 12 }, (_, i) => ({
    label: 'TEST-' + (i + 1),
    gridRow: Math.floor(i / 6) + 1,
    gridColumn: (i % 6) + 1,
  })),
}

describe('future chain seat-grid evidence gate (synthetic only)', () => {
  it('leaves 213 capacity-only research records with an additional dated in89 chart', () => {
    const list = pendingChainSeatSourceWorklist()
    const byBrand = Object.fromEntries(
      [...new Set(list.map((item) => item.brand))].map((brand) => [
        brand,
        {
          branches: new Set(list.filter((entry) => entry.brand === brand).map((x) => x.cinemaSlug))
            .size,
          capacityRecords: list.filter(
            (entry) => entry.brand === brand && entry.publishedSeatCount !== null,
          ).length,
        },
      ]),
    )
    expect(byBrand).toEqual({
      ambassador: { branches: 9, capacityRecords: 81 },
      in89: { branches: 6, capacityRecords: 53 },
      broadway: { branches: 2, capacityRecords: 22 },
      centuryasia: { branches: 4, capacityRecords: 47 },
      skcinemas: { branches: 5, capacityRecords: 0 },
      miramar: { branches: 1, capacityRecords: 10 },
    })
    expect(list).toHaveLength(218)
    expect(
      list.filter((entry) => entry.status === 'need-official-hall-census-and-grid'),
    ).toHaveLength(5)
    expect(list.filter((entry) => entry.status === 'capacity-only-needs-grid')).toHaveLength(213)
    expect(list.every((entry) => entry.seatGridVerified === false)).toBe(true)
    expect(list.every((entry) => !('seatPositions' in entry))).toBe(true)
  })

  it('can only mark structurally complete synthetic evidence as awaiting independent review', () => {
    const result = auditOperatorSeatGridCandidate(sample)
    expect(result.status).toBe('candidate-needs-independent-review')
    expect(result.publishable).toBe(false)
    expect(result.seatPositionsCount).toBe(12)
    expect(result.publicationScope).toBe('public-research-only')
    expect(JSON.stringify(result)).not.toContain('TEST-')
    expect(JSON.stringify(result)).not.toContain('/home/theater_intro_b1')
  })

  it('never accepts capacity cross-references as direct source proof of a physical hall', () => {
    const result = auditOperatorSeatGridCandidate({
      ...sample,
      hallIdentification: 'capacity-cross-reference',
    })
    expect(result.status).toBe('blocked')
    expect(result.reasons).toContain('hall-identity-not-source-confirmed')
  })

  it('rejects invalid official venue, missing source and mismatched hall', () => {
    const wrong = auditOperatorSeatGridCandidate({
      ...sample,
      cinemaSlug: 'ambassador-fabricated-venue',
      sourceCinemaSlug: 'ambassador-fabricated-venue',
      hallLabel: '3廳',
      sourceUrl: 'http://evil.test/example',
    })
    expect(wrong.reasons).toContain('unknown-cinema-or-brand')
    expect(wrong.reasons).toContain('unapproved-source-host')
    expect(wrong.reasons).toContain('hall-identity-not-source-confirmed')
  })

  it('rejects missing grid, duplicate identifiers and duplicate physical coordinates', () => {
    const bad = auditOperatorSeatGridCandidate({
      ...sample,
      completeGrid: false,
      seatPositions: [
        ...sample.seatPositions.slice(0, 11),
        {
          label: sample.seatPositions[0]!.label,
          gridRow: sample.seatPositions[0]!.gridRow,
          gridColumn: sample.seatPositions[0]!.gridColumn,
        },
      ],
    })
    expect(bad.status).toBe('blocked')
    expect(bad.reasons).toEqual(
      expect.arrayContaining([
        'incomplete-grid',
        'duplicate-seat-label',
        'duplicate-seat-coordinate',
      ]),
    )
  })

  it('rejects captured booking state, and keeps member sources private-only', () => {
    const member = auditOperatorSeatGridCandidate({
      ...sample,
      sourceMethod: 'owner-authorised-operator-preview',
      seatPositions: sample.seatPositions.map((item, i) =>
        i === 0 ? { ...item, sold: true } : item,
      ) as typeof sample.seatPositions,
    })
    expect(member.status).toBe('blocked')
    expect(member.publicationScope).toBe('private-research-only')
    expect(member.reasons).toContain('sensitive-booking-fields')
    expect(member.publishable).toBe(false)
  })

  it('rejects impossible seat coordinates and dates', () => {
    const invalid = auditOperatorSeatGridCandidate({
      ...sample,
      observedAt: 'not-an-ISO-date',
      seatPositions: [
        { label: 'A1', gridRow: 0, gridColumn: -1 },
        ...sample.seatPositions.slice(1),
      ],
    })
    expect(invalid.reasons).toEqual(
      expect.arrayContaining(['invalid-observation-date', 'invalid-seat-position']),
    )
  })

  it('does not infer 3D from current Miramar IMAX published seat count', () => {
    const imax = pendingChainSeatSourceWorklist().find(
      (item) => item.cinemaSlug === 'miramar-dazhi' && item.hallLabel === 'IMAX',
    )
    expect(imax?.publishedSeatCount).toBe(373)
    expect(imax?.seatGridVerified).toBe(false)
    expect(imax).not.toHaveProperty('seatPositions')
  })
})
