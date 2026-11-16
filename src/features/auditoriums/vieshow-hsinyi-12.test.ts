import { describe, expect, it } from 'vitest'
import source from './vieshow-hsinyi-12.json'
import { vieshowHsinYi12Auditorium } from './catalog'
import { calculateSightline, createSeats } from './geometry'
import { loadAuditorium } from './schema'
import { cinemaDirectory } from './directory'
import { watchCinemaOptions, watchHallOptions, watchPreviewRoute } from '../history/manual-history'

describe('2026 Golden Horse Classic Film Festival Hsin Yi Vie Show Screen 12 map', () => {
  const model = vieshowHsinYi12Auditorium
  const seats = createSeats(model)
  const seat = (id: string) => {
    const found = seats.find((item) => item.id === id)
    if (!found) throw new Error('Missing map seat ' + id)
    return found
  }

  it('transcribes only the charted 234 standard seat labels across A–P, not the operator 244-seat number', () => {
    expect(loadAuditorium(source)).toEqual(model)
    expect(model.rows.map((row) => row.label)).toEqual('ABCDEFGHIJKLMNOP'.split(''))
    expect(model.rows.map((row) => row.numbers.length)).toEqual([
      16, 16, 16, 16, 14, 10, 16, 16, 16, 16, 16, 16, 16, 16, 14, 4,
    ])
    expect(model.publishedSeatCount).toBe(234)
    expect(seats).toHaveLength(234)
    expect(new Set(seats.map((item) => item.id)).size).toBe(234)
    const hall = cinemaDirectory.find((entry) => entry.slug === 'vieshow-hsinyi-12')
    expect(hall).toMatchObject({
      cinemaSlug: 'vieshow-taipei-hsinyi',
      hallName: '12 廳',
      modelId: model.id,
      seatCount: 244,
      wheelchairSeats: 2,
      seatCountBasis: 'unspecified',
    })
    expect(hall?.screenWidthM).toBeUndefined()
    expect(hall?.screenHeightM).toBeUndefined()
    if (!hall) throw new Error('Missing source-linked Hsin Yi Screen 12')
    expect(hall.seatCount - (seats.length + (hall.wheelchairSeats ?? 0))).toBe(8)
  })

  it('preserves charted omissions, accessible spaces and the larger F/G centre aisle', () => {
    for (const known of [
      'A01',
      'A16',
      'E13',
      'E16',
      'F03',
      'F12',
      'G01',
      'N16',
      'O02',
      'O15',
      'P11',
      'P14',
    ]) {
      expect(seats.some((item) => item.id === known)).toBe(true)
    }
    for (const missing of [
      'E14',
      'E15',
      'F01',
      'F02',
      'F13',
      'F14',
      'F15',
      'F16',
      'O01',
      'O16',
      'P10',
      'P15',
    ]) {
      expect(seats.some((item) => item.id === missing)).toBe(false)
    }
    expect(model.provenance.notes).toContain('W14')
    expect(model.provenance.notes).toContain('W15')
    expect(model.provenance.notes).toContain('244')
    expect(model.rows.find((row) => row.label === 'F')?.aislesAfter).toEqual([])
    expect(seat('G06').z - seat('F06').z).toBeGreaterThan(seat('F06').z - seat('E06').z)
  })

  it('preserves absolute left-centre-right alignment instead of re-centring sparse rows', () => {
    for (const [a, b] of [
      ['E01', 'D01'],
      ['E02', 'D02'],
      ['E03', 'D03'],
      ['E13', 'D13'],
      ['E16', 'D16'],
      ['F03', 'G03'],
      ['F12', 'G12'],
      ['O02', 'N02'],
      ['O15', 'N15'],
      ['P11', 'N11'],
      ['P14', 'N14'],
    ]) {
      expect(seat(a).x, a + ' should share ' + b + ' horizontal column').toBeCloseTo(seat(b).x, 6)
    }
    expect(seat('G03').x - seat('G02').x).toBeCloseTo(model.seatSpacing + model.aisleWidth, 6)
    expect(seat('G15').x - seat('G14').x).toBeCloseTo(model.seatSpacing + model.aisleWidth, 6)
  })

  it('labels screen dimensions, eye height, spacing, slope and actual visual angles as unmeasured estimates', () => {
    expect(model.confidence).toBe('partial')
    expect(model.provenance).toMatchObject({
      seatLabels: 'official',
      screenDimensions: 'estimated',
      spatialGeometry: 'estimated',
      checkedAt: '2026-11-16',
    })
    expect(model.sources).toContain('https://tghff.tixcraft.com/activity/detail/26_ghcffp')
    expect(model.description).toContain('影展')
    const front = calculateSightline(seat('C08'), model.screen)
    const middle = calculateSightline(seat('G08'), model.screen)
    const back = calculateSightline(seat('N08'), model.screen)
    expect(front.distance).toBeLessThan(middle.distance)
    expect(middle.distance).toBeLessThan(back.distance)
    expect(front.horizontalAngle).toBeGreaterThan(middle.horizontalAngle)
    expect(middle.horizontalAngle).toBeGreaterThan(back.horizontalAngle)
    expect(calculateSightline(seat('G02'), model.screen).horizontalOffset).toBeGreaterThan(0)
    expect(calculateSightline(seat('G15'), model.screen).horizontalOffset).toBeLessThan(0)
  })

  it('supports optional manual watch history, without matching a cinema screening', () => {
    expect(watchCinemaOptions.filter((item) => item.slug === 'vieshow-taipei-hsinyi')).toHaveLength(
      1,
    )
    expect(watchHallOptions('vieshow-taipei-hsinyi')).toHaveLength(15)
    const hall = watchHallOptions('vieshow-taipei-hsinyi').find((item) => item.name === '12 廳')
    expect(hall?.modelId).toBe('vieshow-hsinyi-12')
    const entry = {
      id: 'd7f2312f-3fa4-4f62-9ca9-019128adaf01',
      movieTitle: '自行記錄，不需要上映紀錄',
      watchedOn: '2026-11-15',
      cinemaSlug: 'vieshow-taipei-hsinyi',
      cinemaName: '台北信義威秀影城',
      hallName: '12 廳',
      seatLabel: 'G08',
      modelId: 'vieshow-hsinyi-12',
      modelVersion: 1,
      manualEntry: true as const,
      screeningId: null,
      createdAt: '2026-11-16T01:00:00.000Z',
      updatedAt: '2026-11-16T01:00:00.000Z',
    }
    expect(watchPreviewRoute(entry)).toEqual({
      path: '/auditoriums/vieshow-hsinyi-12',
      query: { seat: 'G08' },
    })
    expect(watchPreviewRoute({ ...entry, seatLabel: 'F14' })).toBeNull()
  })
})
