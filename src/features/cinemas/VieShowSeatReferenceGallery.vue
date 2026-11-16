<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { vieshowSeatReferencesForCinema, type VieShowSeatReference } from './vieshow-seat-layouts'

const props = defineProps<{ cinemaSlug: string }>()
const { t } = useI18n()
const candidates = computed(() => vieshowSeatReferencesForCinema(props.cinemaSlug))
const activeId = ref('')
watch(
  candidates,
  (items) => {
    if (!items.some((item) => item.id === activeId.value)) {
      activeId.value = items[0]?.id ?? ''
    }
  },
  { immediate: true },
)

const active = computed(() => candidates.value.find((item) => item.id === activeId.value))
const cellWidth = 30
const cellHeight = 31
const mapWidth = computed(() => Math.max(560, (active.value?.gridColumns ?? 0) * cellWidth + 45))
const mapHeight = computed(() => Math.max(210, (active.value?.gridRows ?? 0) * cellHeight + 77))
const viewBox = computed(() => `0 0 ${mapWidth.value} ${mapHeight.value}`)
const positions = (item: VieShowSeatReference) =>
  t('vieshowSeatRefs.hallOption', {
    number: item.physicalHallNumber,
    count: item.ordinarySeatCount,
  })
const rows = computed(() => {
  const groups = new Map<number, string[]>()
  for (const [label, row] of active.value?.seatPositions ?? []) {
    if (!groups.has(row)) groups.set(row, [])
    groups.get(row)!.push(label)
  }
  return [...groups.entries()].sort(([a], [b]) => a - b)
})
</script>

<template>
  <section
    v-if="candidates.length"
    id="vieshow-seat-references"
    class="seat-references"
    aria-labelledby="vieshow-seat-references-heading"
  >
    <div class="seat-references__heading">
      <div>
        <span class="eyebrow">{{ t('vieshowSeatRefs.eyebrow') }}</span>
        <h2 id="vieshow-seat-references-heading">{{ t('vieshowSeatRefs.title') }}</h2>
        <p>{{ t('vieshowSeatRefs.description') }}</p>
      </div>
      <span>{{ t('vieshowSeatRefs.hallCount', { count: candidates.length }) }}</span>
    </div>

    <label class="seat-references__picker">
      <span>{{ t('vieshowSeatRefs.selectHall') }}</span>
      <select v-model="activeId">
        <option v-for="item in candidates" :key="item.id" :value="item.id">
          {{ positions(item) }}
        </option>
      </select>
    </label>

    <template v-if="active">
      <div class="seat-references__facts">
        <span>{{ t('vieshowSeatRefs.regularSeats', { count: active.ordinarySeatCount }) }}</span>
        <span>{{
          t('vieshowSeatRefs.wheelchairMarkers', { count: active.wheelchairMarkers })
        }}</span>
        <span>{{ t('vieshowSeatRefs.checkedAt', { date: active.observedAt.slice(0, 10) }) }}</span>
      </div>
      <p class="seat-references__notice" role="note">
        {{ t('vieshowSeatRefs.notice') }}
      </p>

      <div
        class="seat-references__scroll"
        tabindex="0"
        :aria-label="t('vieshowSeatRefs.scrollMap')"
      >
        <svg
          :viewBox="viewBox"
          :width="mapWidth"
          :height="mapHeight"
          class="seat-references__svg"
          role="img"
          :aria-label="
            t('vieshowSeatRefs.mapLabel', {
              number: active.physicalHallNumber,
              count: active.ordinarySeatCount,
            })
          "
        >
          <text :x="mapWidth / 2" y="27" text-anchor="middle" class="seat-references__screen-label">
            {{ t('vieshowSeatRefs.screenDirection') }}
          </text>
          <path :d="`M 55 38 L ${mapWidth - 55} 38`" class="seat-references__screen" />
          <g v-for="seat in active.seatPositions" :key="seat[0]">
            <title>{{ seat[0] }}</title>
            <rect
              :x="14 + (seat[2] - 1) * cellWidth"
              :y="65 + (seat[1] - 1) * cellHeight"
              width="26"
              height="25"
              rx="5"
              class="seat-references__seat"
            />
            <text
              :x="27 + (seat[2] - 1) * cellWidth"
              :y="81 + (seat[1] - 1) * cellHeight"
              text-anchor="middle"
              class="seat-references__seat-label"
            >
              {{ seat[0] }}
            </text>
          </g>
          <g v-for="(position, index) in active.wheelchairPositions" :key="'w-' + index">
            <title>{{ t('vieshowSeatRefs.wheelchairMarker') }}</title>
            <rect
              :x="14 + (position[1] - 1) * cellWidth"
              :y="65 + (position[0] - 1) * cellHeight"
              width="26"
              height="25"
              rx="5"
              class="seat-references__seat--special"
            />
            <text
              :x="27 + (position[1] - 1) * cellWidth"
              :y="81 + (position[0] - 1) * cellHeight"
              text-anchor="middle"
              class="seat-references__seat-label"
            >
              W
            </text>
          </g>
        </svg>
      </div>

      <p class="seat-references__legend">
        <span class="seat-references__legend-chip seat-references__legend-chip--regular" />
        {{ t('vieshowSeatRefs.regularLegend') }}
        <span class="seat-references__legend-chip seat-references__legend-chip--special" />
        {{ t('vieshowSeatRefs.wheelchairMarker') }}
      </p>
      <details class="seat-references__labels">
        <summary>{{ t('vieshowSeatRefs.showSeatList') }}</summary>
        <div v-for="[row, seats] in rows" :key="row">
          <strong>{{
            t('vieshowSeatRefs.rowLabel', { label: seats[0]?.replace(/\d+$/, '') })
          }}</strong>
          <span>{{ seats.join(' · ') }}</span>
        </div>
      </details>
      <p class="seat-references__source-note">
        {{ t('vieshowSeatRefs.sourceNote') }}
        <a :href="active.snapshotSource" target="_blank" rel="noopener noreferrer">
          {{ t('vieshowSeatRefs.openOfficial') }}
          <v-icon icon="mdi-open-in-new" size="14" />
        </a>
      </p>
      <p class="seat-references__caution">{{ t('vieshowSeatRefs.caution') }}</p>
    </template>
  </section>
</template>
