<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { centreSeatGrid } from '../cinemas/centred-seat-grid'
import {
  loadVieShowArchiveForCinema,
  type VieShowArchivedLayout,
} from '../cinemas/vieshow-seat-archive'
import { watchVieShowPreviewRoute } from './manual-history'
import type { SeatFootprintGroup } from './seat-footprints'

const props = defineProps<{ group: SeatFootprintGroup }>()
const { t } = useI18n()
const cellHeight = 31

interface ArchivedFootprint {
  layout: VieShowArchivedLayout
  path: string
  validEntryIds: Set<string>
}
const archived = shallowRef<ArchivedFootprint | null>(null)
const loading = ref(false)
const selectedSeat = ref('')

watch(
  () => props.group,
  async (group, _previous, onCleanup) => {
    let cancelled = false
    onCleanup(() => {
      cancelled = true
    })
    archived.value = null
    selectedSeat.value = ''
    loading.value = true
    try {
      if (!group.cinemaSlug) return
      const checked = await Promise.all(
        group.visits.map(async (entry) => {
          try {
            return { entry, route: await watchVieShowPreviewRoute(entry) }
          } catch {
            return { entry, route: null }
          }
        }),
      )
      const first = checked.find((item) => item.route)
      if (!first?.route) return
      const layouts = await loadVieShowArchiveForCinema(group.cinemaSlug)
      const prefix = '/cinemas/' + group.cinemaSlug + '/halls/'
      const layout = layouts.find((item) => prefix + item.id === first.route?.path)
      if (!layout || cancelled) return
      archived.value = {
        layout,
        path: first.route.path,
        // Old festival models and invalid manually typed seats must not be
        // coloured on a different, newer sourced plan.
        validEntryIds: new Set(
          checked
            .filter((item) => item.route?.path === first.route?.path)
            .map((item) => item.entry.id),
        ),
      }
      selectedSeat.value = first.entry.seatLabel
    } finally {
      if (!cancelled) loading.value = false
    }
  },
  { immediate: true },
)

const grid = computed(() =>
  archived.value ? centreSeatGrid(archived.value.layout, 31, cellHeight, 540) : null,
)
const counts = computed(() => {
  const result: Record<string, number> = {}
  if (!archived.value) return result
  for (const entry of props.group.visits) {
    if (!archived.value.validEntryIds.has(entry.id)) continue
    result[entry.seatLabel] = (result[entry.seatLabel] ?? 0) + 1
  }
  return result
})
const selectedVisits = computed(() =>
  props.group.visits.filter(
    (entry) =>
      archived.value?.validEntryIds.has(entry.id) && entry.seatLabel === selectedSeat.value,
  ),
)
const textOnly = computed(() => {
  const count = new Map<string, number>()
  for (const entry of props.group.visits) {
    if (!entry.seatLabel || archived.value?.validEntryIds.has(entry.id)) continue
    count.set(entry.seatLabel, (count.get(entry.seatLabel) ?? 0) + 1)
  }
  return [...count].map(([label, visits]) => ({ label, visits }))
})
const preview = computed(() =>
  archived.value && selectedSeat.value
    ? { path: archived.value.path, query: { seat: selectedSeat.value, view: '3d' } }
    : null,
)
</script>

<template>
  <p v-if="loading" class="manual-history__map-note" role="status">
    {{ t('vieshowSeatRefs.loading') }}
  </p>
  <template v-if="archived && grid">
    <p class="manual-history__map-note">{{ t('history.archivedFootprintMap') }}</p>
    <p
      v-if="
        archived.layout.countComparison === 'different' &&
        archived.layout.publishedSeatCount !== null
      "
      class="manual-history__map-note"
      role="note"
    >
      {{
        t('vieshowSeatRefs.countDifference', {
          observed: archived.layout.ordinarySeatCount,
          published: archived.layout.publishedSeatCount,
        })
      }}
    </p>
    <p
      v-else-if="archived.layout.countComparison === 'not-published'"
      class="manual-history__map-note"
      role="note"
    >
      {{ t('vieshowSeatRefs.notPublished') }}
    </p>
    <div
      class="seat-references__scroll sourced-footprint__scroll"
      tabindex="0"
      :aria-label="t('vieshowSeatRefs.scrollMap')"
    >
      <svg
        class="seat-references__svg"
        :width="grid.width"
        :height="grid.height"
        :viewBox="'0 0 ' + grid.width + ' ' + grid.height"
        role="group"
        :aria-label="
          t('vieshowSeatRefs.mapLabel', {
            hall: archived.layout.hallLabel,
            count: archived.layout.ordinarySeatCount,
          })
        "
      >
        <text :x="grid.width / 2" y="27" text-anchor="middle" class="seat-references__screen-label">
          {{ t('vieshowSeatRefs.screenDirection') }}
        </text>
        <path
          :d="'M ' + grid.screenStartX + ' 38 L ' + grid.screenEndX + ' 38'"
          class="seat-references__screen"
        />
        <g
          v-for="seat in archived.layout.seatPositions"
          :key="seat[0]"
          role="button"
          tabindex="0"
          class="sourced-footprint__seat"
          :class="{ 'is-visited': counts[seat[0]], 'is-selected': selectedSeat === seat[0] }"
          :aria-label="
            seat[0] +
            (counts[seat[0]] ? ' · ' + t('history.seatVisitCount', { count: counts[seat[0]] }) : '')
          "
          :aria-pressed="selectedSeat === seat[0]"
          @click="selectedSeat = seat[0]"
          @keydown.enter.prevent="selectedSeat = seat[0]"
          @keydown.space.prevent="selectedSeat = seat[0]"
        >
          <title>{{ seat[0] }}</title>
          <rect
            :x="grid.seatX(seat[2])"
            :y="65 + (seat[1] - 1) * cellHeight"
            width="26"
            height="25"
            rx="5"
            class="seat-references__seat"
          />
          <text
            :x="grid.labelX(seat[2])"
            :y="81 + (seat[1] - 1) * cellHeight"
            text-anchor="middle"
            class="seat-references__seat-label"
          >
            {{ seat[0] }}
          </text>
        </g>
        <rect
          v-for="(position, i) in archived.layout.wheelchairPositions"
          :key="'wheel-' + i"
          :x="grid.seatX(position[1])"
          :y="65 + (position[0] - 1) * cellHeight"
          width="26"
          height="25"
          rx="5"
          class="seat-references__seat--special"
        />
      </svg>
    </div>
    <div class="manual-history__selected-footprint">
      <div>
        <strong>{{ selectedSeat }}</strong>
        <span>{{
          t(selectedVisits.length ? 'history.seatVisitCount' : 'history.notVisitedSeat', {
            count: selectedVisits.length,
          })
        }}</span>
      </div>
      <RouterLink v-if="preview" :to="preview" class="manual-history__preview-link">
        <v-icon icon="mdi-eye-outline" size="18" />
        {{ t('history.previewSeat') }}
      </RouterLink>
    </div>
    <div v-if="selectedVisits.length" class="manual-history__seat-films">
      <span v-for="entry in selectedVisits" :key="entry.id"
        >{{ entry.movieTitle }} · {{ entry.watchedOn }}</span
      >
    </div>
  </template>
  <div v-if="!loading && (!archived || textOnly.length)" class="manual-history__text-footprints">
    <p>{{ t(archived ? 'history.unmappedSeatNotes' : 'history.noSeatMapYet') }}</p>
    <div v-if="textOnly.length" class="manual-history__text-seat-list">
      <span v-for="seat in textOnly" :key="seat.label">
        {{ seat.label }}
        <small>{{ t('history.seatVisitCount', { count: seat.visits }) }}</small>
      </span>
    </div>
    <p v-else>{{ t('history.noSeatLabel') }}</p>
  </div>
</template>

<style scoped>
.sourced-footprint__scroll {
  max-height: min(45vh, 360px);
}
.sourced-footprint__seat {
  cursor: pointer;
}
.sourced-footprint__seat:focus-visible rect {
  stroke: #f8d49b;
  stroke-width: 2px;
}
.sourced-footprint__seat.is-visited rect {
  fill: #276d6a;
}
.sourced-footprint__seat.is-selected rect {
  fill: #f8d49b;
  stroke: #8b623a;
  stroke-width: 2px;
}
.sourced-footprint__seat.is-selected text {
  fill: #1d2027;
}
</style>
