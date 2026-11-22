import { describe, expect, it } from 'vitest'
import router from './index'

describe('Miranew 3D routes remain distinct after DEV/UAT integration', () => {
  it('resolves both observed and sourced seating pattern deep links', () => {
    const observed = router.resolve(
      '/cinemas/miranew-taimall/seat-patterns/miranew-taimall-8c5d14b8e4979dd3?view=3d',
    )
    const sourced = router.resolve('/cinemas/miranew-taimall/patterns/sample?view=3d')
    expect(observed.name).toBe('miranew-3d-pattern')
    expect(sourced.name).toBe('miranew-sourced-3d-pattern')
    expect(observed.name).not.toBe(sourced.name)
    expect(router.getRoutes().filter((route) => route.name === observed.name)).toHaveLength(1)
    expect(router.getRoutes().filter((route) => route.name === sourced.name)).toHaveLength(1)
  })
})
