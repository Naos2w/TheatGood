<script setup lang="ts">
import { computed } from 'vue'
import type { AuditoriumDefinition, AuditoriumSeat } from '../features/auditoriums/geometry'

const props = defineProps<{
  auditorium: AuditoriumDefinition
  seats: AuditoriumSeat[]
  selectedSeatId: string
}>()
const emit = defineEmits<{ 'select-seat': [seatId: string] }>()

const rows = computed(() =>
  props.auditorium.rows.map((row) => ({
    ...row,
    seats: props.seats.filter((seat) => seat.row === row.label),
  })),
)

/**
 * Use the same X coordinates for the 2D seat map and the TresJS scene.
 * Keep a small horizontal inset so edge seats remain clickable on phones.
 */
const extentX = computed(
  () => Math.max(1, ...props.seats.map((seat) => Math.abs(seat.x))) + props.auditorium.seatWidth,
)
function leftPosition(seat: AuditoriumSeat) {
  return `${50 + (seat.x / extentX.value) * 45}%`
}
</script>

<template>
  <div class="seat-map" aria-label="影廳座位圖">
    <div class="seat-map__screen">銀幕 SCREEN</div>
    <div class="seat-map__rows">
      <div v-for="row in rows" :key="row.label" class="seat-map__row">
        <div class="seat-map__row-label">{{ row.label }}</div>
        <div class="seat-map__seats">
          <button
            v-for="seat in row.seats"
            :key="seat.id"
            class="seat-map__seat"
            :class="{ 'seat-map__seat--selected': selectedSeatId === seat.id }"
            :style="{ left: leftPosition(seat) }"
            type="button"
            :aria-label="`${seat.row} 排 ${seat.number} 號`"
            :aria-pressed="selectedSeatId === seat.id"
            @click="emit('select-seat', seat.id)"
          >
            {{ seat.number }}
          </button>
        </div>
        <div class="seat-map__row-label">{{ row.label }}</div>
      </div>
    </div>
    <div class="seat-map__legend">
      <span><i class="legend-spot legend-spot--available" /> 可選座位</span>
      <span><i class="legend-spot legend-spot--selected" /> 目前視角</span>
    </div>
  </div>
</template>
