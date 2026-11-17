import { demoAuditorium } from './demo'
import tfaiSmallData from './tfai-small.json'
import spotTaipeiData from './spot-taipei.json'
import vieshowHsinYi12Data from './vieshow-hsinyi-12.json'
import { loadAuditorium } from './schema'

/** Source-validated, bundled models work offline. Directory-only halls have no model. */
export const tfaiSmallAuditorium = loadAuditorium(tfaiSmallData)
export const spotTaipeiAuditorium = loadAuditorium(spotTaipeiData)
/** 2026 festival seating chart: charted seats are factual, room geometry estimated. */
export const vieshowHsinYi12Auditorium = loadAuditorium(vieshowHsinYi12Data)

export const auditoriumCatalog = [
  tfaiSmallAuditorium,
  spotTaipeiAuditorium,
  vieshowHsinYi12Auditorium,
  demoAuditorium,
]

export function findAuditorium(id: string) {
  return auditoriumCatalog.find((auditorium) => auditorium.id === id)
}
