import { describe, expect, it } from 'vitest'
import {
  cinemaDirectory,
  normaliseDirectoryName,
  resolveHallAlias,
  searchCinemaDirectory,
} from './directory'
import { auditoriumCatalog, spotTaipeiAuditorium } from './catalog'
import { createSeats, calculateSightline } from './geometry'
import { loadAuditorium } from './schema'
import spotSource from './spot-taipei.json'

describe('source-verified Taiwanese cinema directory', () => {
  it('lists ten source-linked real auditoriums across six cinemas, with unique global slugs', () => {
    expect(cinemaDirectory).toHaveLength(10)
    expect(new Set(cinemaDirectory.map((entry) => entry.slug)).size).toBe(10)
    expect(new Set(cinemaDirectory.map((entry) => entry.cinemaSlug)).size).toBe(6)
    expect(
      cinemaDirectory.every((entry) => entry.sourceUrls.every((url) => url.startsWith('https://'))),
    ).toBe(true)
    expect(cinemaDirectory.every((entry) => /^2026-11-(15|16)$/.test(entry.checkedAt))).toBe(true)
  })

  it('never claims an unverified auditorium has a 3D model or invented dimensions', () => {
    const modelSlugs = cinemaDirectory.flatMap((entry) => (entry.modelId ? [entry.modelId] : []))
    expect(modelSlugs.sort()).toEqual(['spot-taipei', 'tfai-small', 'vieshow-hsinyi-12'])
    for (const entry of cinemaDirectory) {
      if (entry.modelId) {
        expect(auditoriumCatalog.some((model) => model.id === entry.modelId)).toBe(true)
      }
      if (!entry.screenWidthM) expect(entry.screenHeightM).toBeUndefined()
    }
    expect(cinemaDirectory.find((hall) => hall.slug === 'tfai-big')?.seatCountBasis).toBe(
      'excludes-wheelchair',
    )
    expect(cinemaDirectory.find((hall) => hall.slug === 'nwac-reel-two')?.seatCountBasis).toBe(
      'includes-wheelchair',
    )
    const huashanA = cinemaDirectory.find((hall) => hall.slug === 'spot-huashan-a-one')
    const huashanB = cinemaDirectory.find((hall) => hall.slug === 'spot-huashan-a-two')
    expect([huashanA?.screenWidthM, huashanA?.screenHeightM]).toEqual([8.8, 3.8])
    expect([huashanB?.screenWidthM, huashanB?.screenHeightM]).toEqual([8.6, 3.4])
    expect(huashanA?.modelId).toBeUndefined()
    expect(huashanB?.modelId).toBeUndefined()
  })

  it('can search cinemas, cities and names without globally resolving ambiguous hall numbers', () => {
    expect(searchCinemaDirectory('高雄')).toHaveLength(4)
    expect(searchCinemaDirectory('  SPOT Taipei ').map((hall) => hall.slug)).toEqual([
      'spot-taipei',
    ])
    expect(searchCinemaDirectory('')).toHaveLength(10)
    expect(searchCinemaDirectory('信義威秀').map((hall) => hall.slug)).toEqual([
      'vieshow-hsinyi-12',
    ])
    expect(resolveHallAlias('vieshow-taipei-hsinyi', '12廳')?.slug).toBe('vieshow-hsinyi-12')
    expect(normaliseDirectoryName('Ｒｅｅｌ ＯＮＥ')).toBe(normaliseDirectoryName('reel one'))
    expect(resolveHallAlias('spot-huashan', '1廳')?.slug).toBe('spot-huashan-a-one')
    expect(resolveHallAlias('neiwei-art-center', '1廳')?.slug).toBe('nwac-reel-one')
    expect(resolveHallAlias('tfai', '1廳')).toBeUndefined()
  })
})

describe('SPOT Taipei source-verified seating map', () => {
  const model = spotTaipeiAuditorium
  const seats = createSeats(model)

  it('matches the official 9 rows and 83 printed seat IDs without duplicates', () => {
    expect(loadAuditorium(spotSource)).toEqual(model)
    expect(model.publishedSeatCount).toBe(83)
    expect(seats).toHaveLength(83)
    expect(new Set(seats.map((s) => s.id)).size).toBe(83)
    expect(model.rows.map((r) => r.label)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9'])
    expect(seats.some((s) => s.id === '1-10')).toBe(true)
    expect(seats.some((s) => s.id === '2-10')).toBe(false)
    expect(seats.some((s) => s.id === '7-9')).toBe(true)
    expect(seats.some((s) => s.id === '8-9')).toBe(false)
    expect(model.screen.width).toBe(4.7)
    expect(model.screen.height).toBe(1.85)
  })

  it('uses official left/right aisle topology but marks all room geometry estimated', () => {
    const a = seats.find((s) => s.id === '1-2')!
    const b = seats.find((s) => s.id === '1-3')!
    const c = seats.find((s) => s.id === '7-1')!
    const d = seats.find((s) => s.id === '7-2')!
    expect(b.x - a.x).toBeCloseTo(model.seatSpacing + model.aisleWidth)
    expect(d.x - c.x).toBeCloseTo(model.seatSpacing + model.aisleWidth)
    expect(model.provenance.seatLabels).toBe('official')
    expect(model.provenance.screenDimensions).toBe('official')
    expect(model.provenance.spatialGeometry).toBe('estimated')
    expect(calculateSightline(seats[0]!, model.screen).distance).toBeGreaterThan(0)
    expect(seats.at(-1)!.eyeY).toBeGreaterThan(seats[0]!.eyeY)
  })
})
