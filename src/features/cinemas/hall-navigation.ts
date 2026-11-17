import type { DirectoryHall } from '../auditoriums/directory'

/**
 * The festival-only Screen 12 reconstruction remains available as historical
 * evidence. Public discovery links should prefer the newer official-seat
 * snapshot and the shared cinema→hall→seat workflow.
 */
export function directoryHallRoute(hall: Pick<DirectoryHall, 'slug' | 'modelId'>): string {
  if (hall.modelId === 'vieshow-hsinyi-12') {
    return '/cinemas/vieshow-taipei-hsinyi/halls/vieshow-taipei-hsinyi-12'
  }
  return hall.modelId ? '/auditoriums/' + hall.modelId : '/directory/' + hall.slug
}
