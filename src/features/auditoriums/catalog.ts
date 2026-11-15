import { demoAuditorium } from './demo'
import tfaiSmallData from './tfai-small.json'
import spotTaipeiData from './spot-taipei.json'
import { loadAuditorium } from './schema'

/** Source-validated, bundled models work offline. Directory-only halls have no model. */
export const tfaiSmallAuditorium = loadAuditorium(tfaiSmallData)
export const spotTaipeiAuditorium = loadAuditorium(spotTaipeiData)

export const auditoriumCatalog = [tfaiSmallAuditorium, spotTaipeiAuditorium, demoAuditorium]

export function findAuditorium(id: string) {
  return auditoriumCatalog.find((auditorium) => auditorium.id === id)
}
