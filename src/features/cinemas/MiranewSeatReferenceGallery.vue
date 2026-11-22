<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import {
  isReferenceSpecialSeat,
  seatLayoutReferencesForCinema,
  type OfficialSeatLayoutReference,
} from './official-seat-layouts'

const props = defineProps<{ cinemaSlug: string }>()
const { t } = useI18n()
const candidates = computed(() => seatLayoutReferencesForCinema(props.cinemaSlug))
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
const mapWidth = computed(() => {
  const maxCol = Math.max(0, ...(active.value?.seatPositions.map(([, , col]) => col) ?? []))
  return Math.max(560, (maxCol + 1) * cellWidth + 24)
})
const mapHeight = computed(() => {
  const maxRow = Math.max(0, ...(active.value?.seatPositions.map(([, row]) => row) ?? []))
  return Math.max(210, maxRow * cellHeight + 96)
})
const viewBox = computed(() => `0 0 ${mapWidth.value} ${mapHeight.value}`)
const referencedRows = computed(() => {
  const rows = new Map<number, string[]>()
  for (const [seat, row] of active.value?.seatPositions ?? []) {
    if (!rows.has(row)) rows.set(row, [])
    rows.get(row)!.push(seat)
  }
  return [...rows.entries()].sort(([a], [b]) => a - b).map(([, seats]) => seats)
})
const sourceLabel = (item: OfficialSeatLayoutReference): string => {
  const category =
    item.category === 'imax'
      ? 'IMAX'
      : item.category === 'royal'
        ? t('seatRefs.royal')
        : t('seatRefs.standard')
  return `${category} · ${t('seatRefs.labels', { count: item.totalSeatLabels })} · ${item.id.slice(-5)}`
}
</script>

<template>
  <section
    v-if="candidates.length"
    class="seat-references"
    aria-labelledby="seat-references-heading"
  >
    <div class="seat-references__heading">
      <div>
        <span class="eyebrow">{{ t('seatRefs.eyebrow') }}</span>
        <h2 id="seat-references-heading">{{ t('seatRefs.title') }}</h2>
        <p>{{ t('seatRefs.description') }}</p>
      </div>
      <span>{{ t('seatRefs.patternCount', { count: candidates.length }) }}</span>
    </div>
    <label class="seat-references__picker">
      <span>{{ t('seatRefs.selectPattern') }}</span>
      <select v-model="activeId">
        <option v-for="item in candidates" :key="item.id" :value="item.id">
          {{ sourceLabel(item) }}
        </option>
      </select>
    </label>

    <template v-if="active">
      <div class="seat-references__facts">
        <span>{{ t('seatRefs.labels', { count: active.totalSeatLabels }) }}</span>
        <span>{{ t('seatRefs.specialLabels', { count: active.accessibleSeatLabels }) }}</span>
        <span>{{ t('seatRefs.observed', { count: active.repeatedInSample }) }}</span>
      </div>
      <p class="seat-references__notice" role="note">{{ t('seatRefs.unknownHall') }}</p>
      <RouterLink
        class="miranew-pattern-preview-link"
        :to="'/cinemas/' + cinemaSlug + '/seat-patterns/' + active.id"
      >
        <v-icon icon="mdi-cube-scan" size="19" />
        {{
          $i18n.locale.startsWith('en')
            ? 'Explore observed pattern in estimated 3D'
            : '以估算 3D 預覽這份來源座型'
        }}
        <v-icon icon="mdi-chevron-right" size="16" />
      </RouterLink>

      <div class="seat-references__scroll" tabindex="0" :aria-label="t('seatRefs.scrollMap')">
        <svg
          :viewBox="viewBox"
          :width="mapWidth"
          :height="mapHeight"
          class="seat-references__svg"
          role="img"
          :aria-label="t('seatRefs.mapLabel', { count: active.totalSeatLabels })"
        >
          <text :x="mapWidth / 2" y="27" text-anchor="middle" class="seat-references__screen-label">
            {{ t('seatRefs.screenDirection') }}
          </text>
          <path :d="`M 55 38 L ${mapWidth - 55} 38`" class="seat-references__screen" />
          <g v-for="seat in active.seatPositions" :key="seat[0]">
            <rect
              :x="14 + (seat[2] - 1) * cellWidth"
              :y="65 + (seat[1] - 1) * cellHeight"
              width="26"
              height="25"
              rx="5"
              :class="
                isReferenceSpecialSeat(seat[0])
                  ? 'seat-references__seat--special'
                  : 'seat-references__seat'
              "
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
        </svg>
      </div>
      <p class="seat-references__legend">
        <span class="seat-references__legend-chip seat-references__legend-chip--regular" />
        {{ t('seatRefs.normalSeat') }}
        <span class="seat-references__legend-chip seat-references__legend-chip--special" />
        {{ t('seatRefs.wLabel') }}
      </p>
      <details class="seat-references__labels">
        <summary>{{ t('seatRefs.showSeatList') }}</summary>
        <div v-for="(seats, index) in referencedRows" :key="index">
          <strong>{{ t('seatRefs.gridRow', { number: index + 1 }) }}</strong>
          <span>{{ seats.join(' · ') }}</span>
        </div>
      </details>
      <p class="seat-references__source-note">
        {{ t('seatRefs.sourceDate') }}
        <a :href="active.snapshotSource" target="_blank" rel="noopener noreferrer">
          {{ t('seatRefs.openOfficial') }}
          <v-icon icon="mdi-open-in-new" size="14" />
        </a>
      </p>
      <p class="seat-references__caution">{{ t('seatRefs.caution') }}</p>
    </template>
  </section>
</template>

<style scoped>
.miranew-pattern-preview-link {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  max-width: 100%;
  min-height: 44px;
  margin: 10px 0 16px;
  padding: 10px 15px;
  border-radius: 12px;
  text-decoration: none;
  background: rgba(var(--v-theme-primary), 0.13);
  color: rgb(var(--v-theme-primary));
  font-weight: 700;
}
.miranew-pattern-preview-link:hover,
.miranew-pattern-preview-link:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}
</style>
