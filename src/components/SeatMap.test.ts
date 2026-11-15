import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { describe, expect, it, vi } from 'vitest'
import SeatMap from './SeatMap.vue'
import { demoAuditorium } from '../features/auditoriums/demo'
import { createSeats } from '../features/auditoriums/geometry'
import { messages } from '../i18n'

function mountMap(locale: 'zh-TW' | 'en-GB' = 'zh-TW', onSelectSeat?: (id: string) => void) {
  const i18n = createI18n({ legacy: false, locale, messages })
  return mount(SeatMap, {
    global: {
      plugins: [i18n],
      stubs: { VIcon: true },
    },
    props: {
      auditorium: demoAuditorium,
      seats: createSeats(demoAuditorium),
      selectedSeatId: 'E07',
      onSelectSeat,
    },
  })
}

describe('SeatMap interaction', () => {
  it('renders all seats and marks the selected seat accessibly', () => {
    const wrapper = mountMap()
    expect(wrapper.findAll('.seat-map__seat')).toHaveLength(114)
    expect(wrapper.get('[aria-label="E 排 7 號"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[aria-label="H 排 3 號"]').attributes('type')).toBe('button')
    expect(wrapper.get('[aria-label="H 排 3 號"]').attributes('aria-pressed')).toBe('false')
  })

  it('emits a selection and translates seat labels in British English', async () => {
    const onSelectSeat = vi.fn()
    const wrapper = mountMap('en-GB', onSelectSeat)
    await wrapper.get('[aria-label="Row E, seat 6"]').trigger('click')
    expect(onSelectSeat).toHaveBeenCalledWith('E06')
  })
})
