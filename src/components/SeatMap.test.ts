import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SeatMap from './SeatMap.vue'
import { demoAuditorium } from '../features/auditoriums/demo'
import { createSeats } from '../features/auditoriums/geometry'

describe('SeatMap interaction', () => {
  it('renders all seats and marks the selected seat accessibly', () => {
    const wrapper = mount(SeatMap, {
      props: {
        auditorium: demoAuditorium,
        seats: createSeats(demoAuditorium),
        selectedSeatId: 'E07',
      },
    })

    expect(wrapper.findAll('.seat-map__seat')).toHaveLength(114)
    expect(wrapper.get('[aria-label="E 排 7 號"]').attributes('aria-pressed')).toBe('true')

    expect(wrapper.get('[aria-label="H 排 3 號"]').attributes('type')).toBe('button')
    expect(wrapper.get('[aria-label="H 排 3 號"]').attributes('aria-pressed')).toBe('false')
  })
})
