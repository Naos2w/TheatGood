import type { ChainCinema } from './chain-directory'

export type MapPlatform = 'desktop' | 'ios' | 'android'

/**
 * Browser pages cannot query the user's configured default maps app. Android
 * geo: links delegate to installed map handlers; Apple Maps web links delegate
 * to the native Maps app when supported. Desktop explicitly uses Google Maps.
 */
export function identifyMapPlatform(
  userAgent: string,
  platform = '',
  maxTouchPoints = 0,
): MapPlatform {
  if (/android/i.test(userAgent)) return 'android'
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'ios'
  if (/Mac/i.test(platform) && maxTouchPoints > 1) return 'ios' // iPadOS desktop UA
  return 'desktop'
}

export function currentMapPlatform(): MapPlatform {
  if (typeof navigator === 'undefined') return 'desktop'
  return identifyMapPlatform(navigator.userAgent, navigator.platform, navigator.maxTouchPoints ?? 0)
}

type CinemaAddress = Pick<ChainCinema, 'name' | 'address'>

export function googleMapsUrl(cinema: CinemaAddress): string {
  const query = encodeURIComponent(cinema.name + ' ' + cinema.address)
  return 'https://www.google.com/maps/search/?api=1&query=' + query
}

export function cinemaMapUrl(cinema: CinemaAddress, platform: MapPlatform): string {
  const query = encodeURIComponent(cinema.name + ' ' + cinema.address)
  if (platform === 'android') return 'geo:0,0?q=' + query
  if (platform === 'ios') return 'https://maps.apple.com/?q=' + query
  return googleMapsUrl(cinema)
}
