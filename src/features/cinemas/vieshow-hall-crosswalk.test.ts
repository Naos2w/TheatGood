import { describe, expect, it } from 'vitest'
import { publishedVieshowHalls } from './vieshow-halls'
import { loadVieShowArchiveForCinema, vieShowCoverageForCinema } from './vieshow-seat-archive'
import {
  auditUnmatchedVieShowHallNumbers,
  summarizeUnmatchedHallAudits,
} from './vieshow-hall-crosswalk'

describe('Vie Show 2026-05 numbered hall / 2026-11 observed hall provenance', () => {
  it('classifies 24 published unmatched IDs without inventing 3D or permanent identities', async () => {
    const slugs = [
      'vieshow-taipei-hsinyi',
      'vieshow-hsinchu-fe21',
      'vieshow-hsinchu-bigcity',
      'vieshow-taichung-topcity',
      'vieshow-tainan-tsmall',
      'vieshow-kaohsiung-fe21',
      'vieshow-hualien-paradiso',
      'vieshow-muvie-taichung-tigercity',
    ]
    const rows = (
      await Promise.all(
        slugs.map(async (slug) => {
          const coverage = vieShowCoverageForCinema(slug)!
          const archived = await loadVieShowArchiveForCinema(slug)
          return auditUnmatchedVieShowHallNumbers(
            coverage.missingOfficialHalls,
            publishedVieshowHalls.filter((hall) => hall.cinemaSlug === slug),
            archived,
          )
        }),
      )
    ).flat()

    expect(rows).toHaveLength(24)
    expect(summarizeUnmatchedHallAudits(rows)).toEqual({
      'unique-ordinary-capacity-candidate': 10,
      'ambiguous-ordinary-capacity-candidate': 4,
      'wheelchair-inclusive-capacity-candidate': 1,
      'no-capacity-compatible-saved-grid': 9,
    })
    expect(rows.every((row) => !row.permanentlyVerifiedHallIdentity)).toBe(true)
    expect(rows.every((row) => !row.createsNew3DModel)).toBe(true)
    expect(rows.every((row) => !('seatPositions' in row))).toBe(true)
    expect(rows.every((row) => !('snapshotSource' in row))).toBe(true)
  })

  it('explains the seven Tainan old-number rows using existing candidate diagrams, not seven new models', async () => {
    const slug = 'vieshow-tainan-tsmall'
    const layouts = await loadVieShowArchiveForCinema(slug)
    const missing = vieShowCoverageForCinema(slug)!.missingOfficialHalls
    const rows = auditUnmatchedVieShowHallNumbers(
      missing,
      publishedVieshowHalls.filter((entry) => entry.cinemaSlug === slug),
      layouts,
    )
    expect(rows).toHaveLength(7)
    for (const [oldNumber, currentLabel, count] of [
      [11, '第21廳', 74],
      [12, '第22廳', 126],
      [13, '第23廳', 75],
      [14, '第24廳', 53],
      [15, '第25廳', 68],
    ] as const) {
      expect(rows.find((r) => r.oldPublishedHallNumber === oldNumber)).toMatchObject({
        status: 'unique-ordinary-capacity-candidate',
        oldPublishedSeatCount: count,
        matches: [{ observedHallLabel: currentLabel, observedOrdinarySeatCount: count }],
      })
    }
    for (const n of [17, 19]) {
      const item = rows.find((r) => r.oldPublishedHallNumber === n)!
      expect(item.status).toBe('ambiguous-ordinary-capacity-candidate')
      expect(item.matches.map((m) => m.observedHallLabel).sort()).toEqual(['GC1', 'GC2'])
    }
    // 2026-11-23 operator venue page describes 15 halls / 2553 positions /
    // 37 wheelchair spaces. Matching aggregate numbers support coverage
    // without establishing a permanent old-to-new numbering map.
    expect(layouts).toHaveLength(15)
    expect(layouts.reduce((s, hall) => s + hall.ordinarySeatCount, 0)).toBe(2516)
    expect(layouts.reduce((s, hall) => s + hall.wheelchairMarkers, 0)).toBe(37)
    expect(
      layouts.reduce((s, hall) => s + hall.ordinarySeatCount + hall.wheelchairMarkers, 0),
    ).toBe(2553)
  })

  it('identifies Hualien IMAX and A+ as unmatched grid candidates while B/C/D are already observed', async () => {
    const slug = 'vieshow-hualien-paradiso'
    const layouts = await loadVieShowArchiveForCinema(slug)
    const rows = auditUnmatchedVieShowHallNumbers(
      vieShowCoverageForCinema(slug)!.missingOfficialHalls,
      publishedVieshowHalls.filter((entry) => entry.cinemaSlug === slug),
      layouts,
    )
    expect(layouts.map((layout) => layout.hallLabel).sort()).toEqual(['第B廳', '第C廳', '第D廳'])
    expect(rows).toHaveLength(5)
    for (const n of [1, 2]) {
      expect(rows.find((r) => r.oldPublishedHallNumber === n)).toMatchObject({
        status: 'no-capacity-compatible-saved-grid',
        matches: [],
      })
    }
    expect(rows.find((r) => r.oldPublishedHallNumber === 5)).toMatchObject({
      status: 'unique-ordinary-capacity-candidate',
      matches: [{ observedHallLabel: '第C廳', observedOrdinarySeatCount: 124 }],
    })
    for (const n of [3, 6]) {
      expect(
        rows
          .find((r) => r.oldPublishedHallNumber === n)!
          .matches.map((m) => m.observedHallLabel)
          .sort(),
      ).toEqual(['第B廳', '第D廳'])
    }
  })

  it('does not claim a capacity+wheelchair match is the identity of a Gold Class hall', async () => {
    const slug = 'vieshow-kaohsiung-fe21'
    const rows = auditUnmatchedVieShowHallNumbers(
      vieShowCoverageForCinema(slug)!.missingOfficialHalls,
      publishedVieshowHalls.filter((entry) => entry.cinemaSlug === slug),
      await loadVieShowArchiveForCinema(slug),
    )
    expect(rows.find((r) => r.oldPublishedHallNumber === 19)).toMatchObject({
      status: 'wheelchair-inclusive-capacity-candidate',
      matches: [
        {
          observedHallLabel: 'GOLD CLASS',
          observedOrdinarySeatCount: 28,
          observedWheelchairMarkers: 2,
        },
      ],
      permanentlyVerifiedHallIdentity: false,
    })
    expect(rows.find((r) => r.oldPublishedHallNumber === 17)).toMatchObject({
      status: 'no-capacity-compatible-saved-grid',
    })
  })

  it('rejects duplicate published numbers and a source hall incorrectly treated as missing', () => {
    expect(() =>
      auditUnmatchedVieShowHallNumbers(
        [3],
        [
          { hallNumber: 3, publishedSeatCount: 12 },
          { hallNumber: 3, publishedSeatCount: 12 },
        ],
        [],
      ),
    ).toThrow(/repeated/)
    expect(() =>
      auditUnmatchedVieShowHallNumbers([2], [{ hallNumber: 1, publishedSeatCount: 20 }], []),
    ).toThrow(/disagrees/)
    expect(() =>
      auditUnmatchedVieShowHallNumbers(
        [1],
        [{ hallNumber: 1, publishedSeatCount: 20 }],
        [{ hallLabel: '第1廳', hallNumber: 1, ordinarySeatCount: 20, wheelchairMarkers: 0 }],
      ),
    ).toThrow(/already includes/)
    expect(() =>
      auditUnmatchedVieShowHallNumbers(
        [1],
        [{ hallNumber: 1, publishedSeatCount: 20 }],
        [
          { hallLabel: 'GC1', hallNumber: null, ordinarySeatCount: 20, wheelchairMarkers: 0 },
          { hallLabel: 'GC1', hallNumber: null, ordinarySeatCount: 20, wheelchairMarkers: 0 },
        ],
      ),
    ).toThrow(/Duplicate/)
  })
})
