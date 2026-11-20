import { describe, expect, it } from 'vitest'
import { chainCinemas } from '../cinemas/chain-directory'
import { loadVieShowArchiveForCinema } from '../cinemas/vieshow-seat-archive'
import { auditVieShowHallGeometry } from './vieshow-geometry-audit'

describe('source-backed Vie Show sightline sensitivity audits', () => {
  it('keeps official screen dimensions separate from unverified hall identity and estimated depth', async () => {
    const cinemaSlug = 'vieshow-muvie-taipei-a13'
    const layouts = await loadVieShowArchiveForCinema(cinemaSlug)
    const screen6 = layouts.find((layout) => layout.hallNumber === 6)!
    const audit = auditVieShowHallGeometry(cinemaSlug, screen6)
    expect(audit.seatCount).toBe(391)
    expect(audit.screenDimensionsSource).toBe('operator-published')
    expect(audit.screenDimensionsSourceUrl).toBe('https://www.vscinemas.com.tw/about/')
    expect(audit.screenToNumberedHallIdentity).toBe('capacity-only')
    expect(audit.measuredSeatSpacing).toBe(false)
    expect(audit.measuredRowSpacing).toBe(false)
    expect(audit.measuredRowRise).toBe(false)
    expect(audit.measuredScreenToFrontRowDistance).toBe(false)
    expect(audit.fullyMeasured3D).toBe(false)
    expect(audit.samples).toHaveLength(5)
    expect(audit.samples.every((sample) => sample.scenarios.length === 5)).toBe(true)
    const middle = audit.samples.find((sample) => sample.position === 'middle-centre')!
    const closer = middle.scenarios.find((item) => item.scenario === 'closer-steeper')!
    const farther = middle.scenarios.find((item) => item.scenario === 'further-flatter')!
    expect(closer.sightline.distance).toBeLessThan(farther.sightline.distance)
    expect(closer.sightline.horizontalAngle).toBeGreaterThan(farther.sightline.horizontalAngle)
  })

  it('does not elevate a secondary IMAX size or infer screen dimensions for an ordinary hall', async () => {
    const cinemaSlug = 'vieshow-banqiao-megacity'
    const layouts = await loadVieShowArchiveForCinema(cinemaSlug)
    const imax = auditVieShowHallGeometry(
      cinemaSlug,
      layouts.find((layout) => layout.hallNumber === 6)!,
    )
    expect(imax.screenDimensionsSource).toBe('independent-secondary')
    expect(imax.screenToNumberedHallIdentity).toBe('capacity-only')

    const ordinary = auditVieShowHallGeometry(
      cinemaSlug,
      layouts.find((layout) => layout.hallNumber === 5)!,
    )
    expect(ordinary.screenDimensionsSource).toBe('estimated')
    expect(ordinary.screenDimensionsSourceUrl).toBeNull()
    expect(ordinary.screenToNumberedHallIdentity).toBe('no-screen-specification')
    expect(ordinary.fullyMeasured3D).toBe(false)
  })

  it('audits all 222 seat layouts without losing a sourced label or inventing surveyed geometry', async () => {
    let audited = 0
    let mismatched = 0
    for (const venue of chainCinemas.filter((cinema) => cinema.brand === 'vieshow')) {
      const layouts = await loadVieShowArchiveForCinema(venue.slug)
      for (const layout of layouts) {
        const audit = auditVieShowHallGeometry(venue.slug, layout)
        const originalIds = new Set(layout.seatPositions.map(([label]) => label))
        expect(audit.seatCount).toBe(originalIds.size)
        expect(audit.hallLabel).toBe(layout.hallLabel)
        expect(audit.observedAt).toBe(layout.observedAt)
        expect(audit.layoutSource).toBe(layout.snapshotSource)
        expect(audit.fullyMeasured3D).toBe(false)
        expect(audit.samples).toHaveLength(5)
        for (const sample of audit.samples) {
          expect(originalIds.has(sample.seatId)).toBe(true)
          expect(sample.scenarios.map((item) => item.scenario)).toEqual([
            'default',
            'closer-steeper',
            'further-flatter',
            'wider-block',
            'narrower-block',
          ])
          const metrics = sample.scenarios.flatMap((scenario) => Object.values(scenario.sightline))
          expect(metrics.every(Number.isFinite)).toBe(true)
          expect(sample.scenarioExtrema.minHorizontalAngle).toBeLessThanOrEqual(
            sample.scenarioExtrema.maxHorizontalAngle,
          )
          expect(sample.scenarioExtrema.minVerticalAngle).toBeLessThanOrEqual(
            sample.scenarioExtrema.maxVerticalAngle,
          )
        }
        if (audit.publishedCapacityComparison === 'different') mismatched += 1
        audited += 1
      }
    }
    expect(audited).toBe(222)
    expect(mismatched).toBe(18)
  })
})
