<script setup lang="ts">
import { nextTick, onUnmounted, shallowRef, watch } from 'vue'
import type { Group } from 'three'
import type { AuditoriumSeat } from '../auditoriums/geometry'
import { createCinemaSeatInstances, disposeCinemaSeatInstances } from './cinema-seat-instances'

const props = defineProps<{ seats: AuditoriumSeat[]; seatWidth: number }>()
const batches = shallowRef<Group | null>(null)

// Six instanced seat-part batches, independent of individual hall dimensions.
watch(
  () => [props.seats, props.seatWidth] as const,
  ([seats, width]) => {
    const previous = batches.value
    batches.value = createCinemaSeatInstances(seats, width)
    if (previous) void nextTick(() => disposeCinemaSeatInstances(previous))
  },
  { immediate: true },
)
onUnmounted(() => {
  if (batches.value) disposeCinemaSeatInstances(batches.value)
})
</script>

<template>
  <primitive v-if="batches" :object="batches" />
</template>
