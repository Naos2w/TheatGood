import { describe, expect, it } from 'vitest'
import { MUVIE_SENSORY_PILOT_HALL_ID, usesCinemaSensoryPilot } from './cinema-sensory-scope'

describe('dedicated MUVIE film/audio sensory experience', () => {
  it('only enables the agreed MUVIE A13 Hall 1, with matching route identity', () => {
    expect(usesCinemaSensoryPilot(MUVIE_SENSORY_PILOT_HALL_ID, MUVIE_SENSORY_PILOT_HALL_ID)).toBe(
      true,
    )
    expect(usesCinemaSensoryPilot(MUVIE_SENSORY_PILOT_HALL_ID, 'vieshow-taipei-hsinyi-1')).toBe(
      false,
    )
    expect(usesCinemaSensoryPilot('vieshow-taipei-hsinyi-1', 'vieshow-taipei-hsinyi-1')).toBe(false)
    expect(usesCinemaSensoryPilot('vieshow-muvie-taipei-a13-2', 'vieshow-muvie-taipei-a13-2')).toBe(
      false,
    )
    expect(usesCinemaSensoryPilot(undefined, MUVIE_SENSORY_PILOT_HALL_ID)).toBe(false)
  })
})
