import { describe, expect, it } from 'vitest'
import { cinemaDirectory } from '../auditoriums/directory'
import { createSeats } from '../auditoriums/geometry'
import { findAuditorium } from '../auditoriums/catalog'
import { chainCinemas } from './chain-directory'
import {
  loadVieShowArchiveForCinema,
  vieShowCoverageForCinema,
  vieShowArchiveSummary,
} from './vieshow-seat-archive'
import { directoryHallRoute } from './hall-navigation'
import router from '../../router'

describe('cinema → auditorium → seat navigation', () => {
  it('makes the newer 244-seat Hsin Yi Screen 12 the primary route instead of the 234-seat festival reference', async () => {
    const hall = cinemaDirectory.find((item) => item.modelId === 'vieshow-hsinyi-12')!
    expect(directoryHallRoute(hall)).toBe(
      '/cinemas/vieshow-taipei-hsinyi/halls/vieshow-taipei-hsinyi-12',
    )
    const currentLayouts = await loadVieShowArchiveForCinema('vieshow-taipei-hsinyi')
    expect(currentLayouts.find((item) => item.hallNumber === 12)?.ordinarySeatCount).toBe(244)
    const festival = findAuditorium('vieshow-hsinyi-12')!
    expect(createSeats(festival)).toHaveLength(234)
    expect(router.resolve(directoryHallRoute(hall)).name).toBe('vieshow-3d-preview')
    expect(router.resolve('/auditoriums/vieshow-hsinyi-12').name).toBe('viewer')
  })

  it('keeps cultural cinema model routes and specifications-only routes intact', () => {
    const small = cinemaDirectory.find((item) => item.modelId === 'tfai-small')!
    const infoOnly = cinemaDirectory.find((item) => item.slug === 'tfai-big')!
    expect(directoryHallRoute(small)).toBe('/auditoriums/tfai-small')
    expect(directoryHallRoute(infoOnly)).toBe('/directory/tfai-big')
    expect(router.resolve(directoryHallRoute(small)).name).toBe('viewer')
    expect(router.resolve(directoryHallRoute(infoOnly)).name).toBe('directory-detail')
  })

  it('all 22 Vie Show locations expose a valid venue route and their collected hall routes', async () => {
    const venues = chainCinemas.filter((item) => item.brand === 'vieshow')
    expect(venues).toHaveLength(22)
    let hallModels = 0
    for (const venue of venues) {
      const coverage = vieShowCoverageForCinema(venue.slug)
      expect(coverage?.observedLabels).toBeGreaterThan(0)
      expect(router.resolve('/cinemas/' + venue.slug).name).toBe('chain-cinema')
      const layouts = await loadVieShowArchiveForCinema(venue.slug)
      expect(layouts.length).toBe(coverage?.observedLabels)
      for (const item of layouts) {
        const url = '/cinemas/' + venue.slug + '/halls/' + item.id
        expect(router.resolve(url).name).toBe('vieshow-3d-preview')
        expect(item.seatPositions.length).toBe(item.ordinarySeatCount)
      }
      hallModels += layouts.length
    }
    expect(hallModels).toBe(222)
    expect(vieShowArchiveSummary.layouts).toBe(hallModels)
  })

  it('marks missing published halls as incomplete without creating fake seat selection models', () => {
    const hsinyi = vieShowCoverageForCinema('vieshow-taipei-hsinyi')!
    expect(hsinyi.observedLabels).toBe(14)
    expect(hsinyi.publishedHalls).toBe(15)
    expect(hsinyi.missingOfficialHalls).toContain(13)
    expect(hsinyi.layoutFacts.some((hall) => hall.hallNumber === 13)).toBe(false)
    expect(hsinyi.layoutFacts.find((hall) => hall.hallNumber === 11)?.ordinarySeatCount).toBe(254)
  })
})
