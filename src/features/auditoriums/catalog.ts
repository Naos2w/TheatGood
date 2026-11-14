import { demoAuditorium } from './demo'
import tfaiSmallData from './tfai-small.json'
import { loadAuditorium } from './schema'

/** These models are bundled locally; no backend or Neon credentials are required. */
export const tfaiSmallAuditorium = loadAuditorium(tfaiSmallData)

export const auditoriumCatalog = [tfaiSmallAuditorium, demoAuditorium]

export function findAuditorium(id: string) {
  return auditoriumCatalog.find((auditorium) => auditorium.id === id)
}
