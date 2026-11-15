<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { AuditoriumDefinition, AuditoriumSeat } from '../features/auditoriums/geometry'

const props = defineProps<{
  auditorium: AuditoriumDefinition
  seats: AuditoriumSeat[]
  selectedSeatId: string
}>()
const emit = defineEmits<{ 'select-seat': [seatId: string] }>()
const { t } = useI18n()

const rows = computed(() =>
  props.auditorium.rows.map((row) => ({
    ...row,
    seats: props.seats.filter((seat) => seat.row === row.label),
  })),
)
const extentX = computed(
  () => Math.max(1, ...props.seats.map((seat) => Math.abs(seat.x))) + props.auditorium.seatWidth,
)
const mapHeight = computed(() => 103 + rows.value.length * 54)
const viewportRef = ref<HTMLElement | null>(null)
const sheetRef = ref<HTMLDialogElement | null>(null)
const viewportWidth = ref(360)
const zoom = ref(1)
const pan = reactive({ x: 0, y: 0 })
const selectedRow = ref(
  props.seats.find((seat) => seat.id === props.selectedSeatId)?.row ??
    props.auditorium.rows[0]?.label ??
    'A',
)
const fitScale = computed(() => Math.min(1, Math.max(0.3, (viewportWidth.value - 12) / 680)))
const currentScale = computed(() => fitScale.value * zoom.value)
const viewportHeight = computed(() => Math.max(290, mapHeight.value * fitScale.value + 14))
const mapTransform = computed(() => {
  const centreX = (viewportWidth.value - 680 * currentScale.value) / 2 + pan.x
  return {
    height: mapHeight.value + 'px',
    transform: 'translate(' + centreX + 'px, ' + pan.y + 'px) scale(' + currentScale.value + ')',
  }
})
const focusedRow = computed(() => rows.value.find((row) => row.label === selectedRow.value))
const activePointers = new Map<number, { x: number; y: number; canPan: boolean }>()
let pinchDistance = 0
let resizeObserver: ResizeObserver | undefined

watch(
  () => props.selectedSeatId,
  (id) => {
    if (id) selectedRow.value = props.seats.find((seat) => seat.id === id)?.row ?? selectedRow.value
  },
)

function leftPosition(seat: AuditoriumSeat) {
  return 340 + (seat.x / extentX.value) * 292 + 'px'
}

function selectSeat(id: string) {
  emit('select-seat', id)
}

function updateWidth() {
  if (viewportRef.value) viewportWidth.value = viewportRef.value.clientWidth || 360
}

function changeZoom(next: number) {
  zoom.value = Math.min(3.2, Math.max(1, next))
  if (zoom.value === 1) {
    pan.x = 0
    pan.y = 0
  }
}
function resetZoom() {
  changeZoom(1)
}

function pointerDown(event: PointerEvent) {
  if (event.pointerType === 'mouse' && event.button !== 0) return
  const canPan = !(event.target instanceof Element && event.target.closest('button'))
  activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY, canPan })
  if (canPan) (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  pinchDistance = 0
}

function pointerMove(event: PointerEvent) {
  const pointer = activePointers.get(event.pointerId)
  if (!pointer) return
  const dx = event.clientX - pointer.x
  const dy = event.clientY - pointer.y
  pointer.x = event.clientX
  pointer.y = event.clientY

  if (activePointers.size >= 2) {
    const points = [...activePointers.values()]
    const distance = Math.hypot(points[0]!.x - points[1]!.x, points[0]!.y - points[1]!.y)
    if (pinchDistance > 0) changeZoom(zoom.value * (distance / pinchDistance))
    pinchDistance = distance
    return
  }

  if (pointer.canPan && zoom.value > 1) {
    pan.x += dx
    pan.y += dy
  }
}

function pointerUp(event: PointerEvent) {
  activePointers.delete(event.pointerId)
  pinchDistance = 0
}

function openSheet() {
  selectedRow.value =
    props.seats.find((seat) => seat.id === props.selectedSeatId)?.row ?? rows.value[0]?.label ?? 'A'
  sheetRef.value?.showModal()
}

function chooseSeat(id: string) {
  emit('select-seat', id)
  sheetRef.value?.close()
}

onMounted(() => {
  updateWidth()
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(updateWidth)
    if (viewportRef.value) resizeObserver.observe(viewportRef.value)
  }
})
onUnmounted(() => resizeObserver?.disconnect())
</script>

<template>
  <div class="seat-map" :aria-label="t('seats.mapAria')">
    <div
      ref="viewportRef"
      class="seat-map__viewport"
      :style="{ height: viewportHeight + 'px' }"
      :aria-label="t('seats.mapHelp')"
      @pointerdown="pointerDown"
      @pointermove="pointerMove"
      @pointerup="pointerUp"
      @pointercancel="pointerUp"
    >
      <div class="seat-map__layout" :style="mapTransform">
        <div class="seat-map__screen">
          <span>{{ t('seats.screen') }}</span>
        </div>
        <div
          v-for="(row, index) in rows"
          :key="row.label"
          class="seat-map__row"
          :style="{ top: 100 + index * 54 + 'px' }"
        >
          <span class="seat-map__row-label seat-map__row-label--left">{{ row.label }}</span>
          <button
            v-for="seat in row.seats"
            :key="seat.id"
            class="seat-map__seat"
            :class="{ 'seat-map__seat--selected': selectedSeatId === seat.id }"
            :style="{ left: leftPosition(seat) }"
            type="button"
            :aria-label="t('seats.selectAria', { row: seat.row, number: seat.number })"
            :aria-pressed="selectedSeatId === seat.id"
            @click="selectSeat(seat.id)"
          >
            {{ String(seat.number).padStart(2, '0') }}
          </button>
          <span class="seat-map__row-label seat-map__row-label--right">{{ row.label }}</span>
        </div>
      </div>
    </div>

    <div class="seat-map__toolbar">
      <span class="seat-map__help">{{ t('seats.mapHelp') }}</span>
      <div class="seat-map__zoom-controls">
        <button
          type="button"
          class="icon-button"
          :aria-label="t('seats.zoomOut')"
          :disabled="zoom <= 1"
          @click="changeZoom(zoom / 1.35)"
        >
          <span class="mdi mdi-minus" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="icon-button"
          :aria-label="t('seats.resetZoom')"
          @click="resetZoom"
        >
          <span class="mdi mdi-fit-to-screen" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="icon-button"
          :aria-label="t('seats.zoomIn')"
          :disabled="zoom >= 3.2"
          @click="changeZoom(zoom * 1.35)"
        >
          <span class="mdi mdi-plus" aria-hidden="true" />
        </button>
      </div>
    </div>

    <div class="seat-map__footer">
      <div class="seat-map__legend">
        <span><i class="legend-spot legend-spot--available" />{{ t('seats.normal') }}</span>
        <span><i class="legend-spot legend-spot--selected" />{{ t('seats.selectedLegend') }}</span>
      </div>
      <button type="button" class="seat-map__focus-button" @click="openSheet">
        <span class="mdi mdi-arrow-expand" aria-hidden="true" />
        {{ t('seats.choosePrecisely') }}
      </button>
    </div>

    <dialog ref="sheetRef" class="seat-sheet" :aria-label="t('seats.chooseRow')">
      <div class="seat-sheet__header">
        <strong>{{ t('seats.chooseSeatInRow', { row: selectedRow }) }}</strong>
        <button
          type="button"
          class="icon-button"
          :aria-label="t('app.close')"
          @click="sheetRef?.close()"
        >
          <span class="mdi mdi-close" aria-hidden="true" />
        </button>
      </div>
      <div class="seat-sheet__rows" role="group" :aria-label="t('seats.chooseRow')">
        <button
          v-for="row in rows"
          :key="row.label"
          type="button"
          :aria-pressed="selectedRow === row.label"
          :class="{ active: selectedRow === row.label }"
          @click="selectedRow = row.label"
        >
          {{ row.label }}
        </button>
      </div>
      <div class="seat-sheet__choices">
        <button
          v-for="seat in focusedRow?.seats ?? []"
          :key="seat.id"
          type="button"
          :class="{ active: selectedSeatId === seat.id }"
          :aria-label="t('seats.selectAria', { row: seat.row, number: seat.number })"
          :aria-pressed="selectedSeatId === seat.id"
          @click="chooseSeat(seat.id)"
        >
          {{ seat.number }}
        </button>
      </div>
    </dialog>
  </div>
</template>
