import { describe, expect, it } from 'vitest'
import { chainCinemas } from './chain-directory'
import { officialShowtimeLink, officialShowtimeLinks } from './official-showtimes'

describe('source-verified chain cinema timetable links', () => {
  it('covers all 40 commercial cinema branches with only operator-owned HTTPS domains', () => {
    expect(chainCinemas).toHaveLength(40)
    expect(Object.keys(officialShowtimeLinks)).toHaveLength(40)
    expect(new Set(Object.keys(officialShowtimeLinks)).size).toBe(40)
    for (const cinema of chainCinemas) {
      const item = officialShowtimeLink(cinema.slug)
      expect(item?.checkedAt).toBe('2026-11-16')
      expect(item?.cinemaSlug).toBe(cinema.slug)
      const url = new URL(item!.url)
      expect(url.protocol).toBe('https:')
      expect([
        'www.vscinemas.com.tw',
        'www.showtimes.com.tw',
        'www.miramarcinemas.tw',
        'www.miranewcinemas.com',
      ]).toContain(url.hostname)
      expect(url.username).toBe('')
      expect(url.password).toBe('')
      expect(url.hash).toBe('')
      expect(item!.scope).toMatch(/^(cinema|brand)$/)
    }
  })

  it('links Vie Show and MUVIE to 22 different operator-owned cinema timetable pages', () => {
    const items = chainCinemas
      .filter((cinema) => cinema.brand === 'vieshow')
      .map((cinema) => officialShowtimeLink(cinema.slug)!)
    expect(items).toHaveLength(22)
    expect(new Set(items.map((item) => item.url)).size).toBe(22)
    expect(items.every((item) => item.scope === 'cinema')).toBe(true)
    expect(items.filter((item) => /detail2\.aspx/.test(item.url))).toHaveLength(2)
    expect(officialShowtimeLink('vieshow-taipei-hsinyi')?.url).toBe(
      'https://www.vscinemas.com.tw/theater/detail.aspx?id=1',
    )
    expect(officialShowtimeLink('vieshow-muvie-taipei-a13')?.url).toBe(
      'https://www.vscinemas.com.tw/theater/detail2.aspx?id=23',
    )
    expect(officialShowtimeLink('vieshow-muvie-taichung-tigercity')?.url).toBe(
      'https://www.vscinemas.com.tw/theater/detail2.aspx?id=12',
    )
  })

  it('matches the 15 Showtime branch URLs from the operator official listing', () => {
    const items = chainCinemas
      .filter((cinema) => cinema.brand === 'showtime')
      .map((cinema) => officialShowtimeLink(cinema.slug)!)
    expect(items).toHaveLength(15)
    expect(new Set(items.map((item) => item.url)).size).toBe(15)
    expect(items.every((item) => item.scope === 'cinema')).toBe(true)
    expect(officialShowtimeLink('showtime-taipei-dome')?.url).toBe(
      'https://www.showtimes.com.tw/cinemas/91/',
    )
    expect(officialShowtimeLink('showtime-taichung-lipao')?.url).toBe(
      'https://www.showtimes.com.tw/cinemas/59/',
    )
  })

  it('does not fabricate Miranew cinema deep links when the official page requires selection', () => {
    expect(officialShowtimeLink('miramar-dazhi')).toMatchObject({
      scope: 'cinema',
      url: 'https://www.miramarcinemas.tw/Timetable/Index',
    })
    expect(officialShowtimeLink('miranew-taimall')).toMatchObject({
      scope: 'brand',
      url: 'https://www.miranewcinemas.com/Booking/Timetable',
    })
    expect(officialShowtimeLink('miranew-dazhi-royal')).toMatchObject({
      scope: 'brand',
      url: 'https://www.miranewcinemas.com/Booking/Timetable',
    })
    expect(officialShowtimeLink('no-such-cinema')).toBeUndefined()
  })

  it('does not make any claim to imported sessions or seat inventory', () => {
    for (const item of Object.values(officialShowtimeLinks)) {
      expect(item).not.toHaveProperty('screenings')
      expect(item).not.toHaveProperty('availableSeats')
      expect(item).not.toHaveProperty('movie')
      expect(item).not.toHaveProperty('ticketPrice')
      expect(item).not.toHaveProperty('auditoriumId')
    }
  })
})
