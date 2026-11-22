/** Dedicated film/audio experience was only approved for MUVIE A13 Hall 1. */
export const MUVIE_SENSORY_PILOT_HALL_ID = 'vieshow-muvie-taipei-a13-1'

export function usesCinemaSensoryPilot(
  archivedHallId: string | undefined,
  routeHallId: string,
): boolean {
  return (
    archivedHallId === MUVIE_SENSORY_PILOT_HALL_ID && routeHallId === MUVIE_SENSORY_PILOT_HALL_ID
  )
}
