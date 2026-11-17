import { describe, expect, it } from 'vitest'
import { chainCinemas } from './chain-directory'
import { cinemaMapUrl, googleMapsUrl, identifyMapPlatform } from './map-links'

describe("open cinema maps in the user's device app when supported", () => {
  const hsinyi = chainCinemas.find((cinema) => cinema.slug === 'vieshow-taipei-hsinyi')!

  it('uses Google Maps web search on desktop, not the OSM source evidence URL', () => {
    expect(identifyMapPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Win32')).toBe(
      'desktop',
    )
    const url = new URL(cinemaMapUrl(hsinyi, 'desktop'))
    expect(url.origin).toBe('https://www.google.com')
    expect(url.pathname).toBe('/maps/search/')
    expect(url.searchParams.get('api')).toBe('1')
    expect(url.searchParams.get('query')).toContain('台北信義威秀')
    expect(url.searchParams.get('query')).toContain('松壽路20號')
    expect(googleMapsUrl(hsinyi)).toBe(url.href)
    expect(url.href).not.toMatch(/openstreetmap/i)
  })

  it('delegates to Android geo: map handling instead of forcing Google Maps', () => {
    expect(identifyMapPlatform('Mozilla/5.0 (Linux; Android 16; Pixel 9)')).toBe('android')
    const href = cinemaMapUrl(hsinyi, 'android')
    expect(href).toMatch(/^geo:0,0\?q=/)
    expect(decodeURIComponent(href)).toContain(hsinyi.name)
    expect(decodeURIComponent(href)).toContain(hsinyi.address)
  })

  it('uses Apple Maps URLs for iPhone, iPad and iPadOS desktop user agents', () => {
    expect(identifyMapPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 18_4 like Mac OS X)')).toBe(
      'ios',
    )
    expect(identifyMapPlatform('Mozilla/5.0 (iPad; CPU OS 18_4 like Mac OS X)')).toBe('ios')
    expect(identifyMapPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X)', 'MacIntel', 5)).toBe(
      'ios',
    )
    expect(identifyMapPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X)', 'MacIntel', 0)).toBe(
      'desktop',
    )
    const href = new URL(cinemaMapUrl(hsinyi, 'ios'))
    expect(href.origin).toBe('https://maps.apple.com')
    expect(href.searchParams.get('q')).toContain(hsinyi.name)
  })

  it('creates named, address-qualified links for all 40 cinema venues', () => {
    expect(chainCinemas).toHaveLength(40)
    for (const cinema of chainCinemas) {
      const desktop = new URL(cinemaMapUrl(cinema, 'desktop'))
      expect(desktop.searchParams.get('query')).toContain(cinema.name)
      expect(desktop.searchParams.get('query')).toContain(cinema.address)
      expect(cinemaMapUrl(cinema, 'android')).toContain('geo:0,0?q=')
      expect(cinemaMapUrl(cinema, 'ios')).toContain('https://maps.apple.com/')
    }
  })
})
