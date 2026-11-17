<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import {
  loadVieShowArchiveForCinema,
  vieShowCoverageForCinema,
  type VieShowArchivedLayout,
} from './vieshow-seat-archive'

const props = defineProps<{ cinemaSlug: string }>()
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const coverage = computed(() => vieShowCoverageForCinema(props.cinemaSlug))
const candidates = ref<readonly VieShowArchivedLayout[]>([])
const loading = ref(false)
const failed = ref(false)
const activeId = ref('')

watch(
  () => props.cinemaSlug,
  async (slug, _oldSlug, onCleanup) => {
    candidates.value = []
    activeId.value = ''
    failed.value = false
    loading.value = Boolean(vieShowCoverageForCinema(slug))
    if (!loading.value) return

    let cancelled = false
    onCleanup(() => {
      cancelled = true
    })
    try {
      const layouts = await loadVieShowArchiveForCinema(slug)
      if (cancelled) return
      candidates.value = layouts
      const requested = typeof route.query.hall === 'string' ? route.query.hall : ''
      activeId.value =
        layouts.find(
          (item) =>
            item.id === requested ||
            String(item.hallNumber) === requested ||
            item.hallLabel === requested,
        )?.id ??
        layouts[0]?.id ??
        ''
    } catch {
      if (!cancelled) failed.value = true
    } finally {
      if (!cancelled) loading.value = false
    }
  },
  { immediate: true },
)

watch(
  () => route.query.hall,
  (requested) => {
    if (typeof requested !== 'string') return
    const match = candidates.value.find(
      (item) =>
        item.id === requested ||
        String(item.hallNumber) === requested ||
        item.hallLabel === requested,
    )
    if (match) activeId.value = match.id
  },
)

function changeHall(id: string) {
  const item = candidates.value.find((entry) => entry.id === id)
  if (!item) return
  activeId.value = item.id
  void router.replace({
    query: { ...route.query, hall: String(item.hallNumber ?? item.hallLabel) },
  })
}

const active = computed(() => candidates.value.find((item) => item.id === activeId.value))
const cellWidth = 30
const cellHeight = 31
const mapWidth = computed(() => Math.max(560, (active.value?.gridColumns ?? 0) * cellWidth + 45))
const mapHeight = computed(() => Math.max(210, (active.value?.gridRows ?? 0) * cellHeight + 77))
const viewBox = computed(() => '0 0 ' + mapWidth.value + ' ' + mapHeight.value)
const hallOption = (item: VieShowArchivedLayout): string =>
  t('vieshowSeatRefs.hallOption', { hall: item.hallLabel, count: item.ordinarySeatCount })

const countNotice = computed(() => {
  const item = active.value
  if (!item) return ''
  if (item.countComparison === 'not-published') return t('vieshowSeatRefs.notPublished')
  if (item.countComparison === 'different') {
    return t('vieshowSeatRefs.countDifference', {
      observed: item.ordinarySeatCount,
      published: item.publishedSeatCount,
    })
  }
  if (item.countComparison === 'wheelchair-markers-match') {
    return t('vieshowSeatRefs.wheelchairCountMatch')
  }
  return t('vieshowSeatRefs.exactCount')
})

const rows = computed(() => {
  const grouped = new Map<number, string[]>()
  for (const [seatLabel, row] of active.value?.seatPositions ?? []) {
    if (!grouped.has(row)) grouped.set(row, [])
    grouped.get(row)!.push(seatLabel)
  }
  return [...grouped.entries()]
    .sort(([a], [b]) => a - b)
    .map(([visualRow, seats]) => {
      const alpha = /^([A-Z]{1,2})\d+$/i.exec(seats[0] ?? '')?.[1]
      return {
        visualRow,
        rowLabel: alpha
          ? t('vieshowSeatRefs.rowLabel', { label: alpha })
          : t('vieshowSeatRefs.visualRow', { number: visualRow }),
        seats,
      }
    })
})
</script>

<template>
  <section
    v-if="coverage"
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
      <span>{{ t('vieshowSeatRefs.hallCount', { count: coverage.observedLabels }) }}</span>
    </div>

    <p class="seat-references__source-note">
      {{
        t('vieshowSeatRefs.coverage', {
          matched: coverage.matchedPublishedHalls,
          published: coverage.publishedHalls,
        })
      }}
      <span v-if="coverage.missingOfficialHalls.length">
        {{ t('vieshowSeatRefs.unmappedCount', { count: coverage.missingOfficialHalls.length }) }}
      </span>
    </p>

    <p v-if="loading" role="status">{{ t('vieshowSeatRefs.loading') }}</p>
    <p v-else-if="failed" role="alert">{{ t('vieshowSeatRefs.failed') }}</p>

    <template v-else-if="candidates.length">
      <div class="vieshow-hall-selector">
        <div class="vieshow-hall-selector__heading">
          <h3>{{ t('vieshowSeatRefs.selectHall') }}</h3>
          <span>{{ t('vieshowSeatRefs.hallPickerHint') }}</span>
        </div>
        <div
          class="vieshow-hall-selector__grid"
          role="group"
          :aria-label="t('vieshowSeatRefs.selectHall')"
        >
          <button
            v-for="item in candidates"
            :key="item.id"
            type="button"
            class="vieshow-hall-selector__tile"
            :class="{
              'vieshow-hall-selector__tile--active': item.id === activeId,
              'vieshow-hall-selector__tile--warning': item.countComparison === 'different',
            }"
            :aria-pressed="item.id === activeId"
            @click="changeHall(item.id)"
          >
            <strong>{{ item.hallLabel }}</strong>
            <small>{{
              t('vieshowSeatRefs.regularSeats', { count: item.ordinarySeatCount })
            }}</small>
            <span
              v-if="item.countComparison === 'different'"
              class="vieshow-hall-selector__warning"
            >
              <v-icon icon="mdi-alert-circle-outline" size="14" />
              {{ t('vieshowSeatRefs.countNeedsReview') }}
            </span>
            <span v-else class="vieshow-hall-selector__ready">
              <v-icon icon="mdi-check-circle-outline" size="14" />
              {{ t('vieshowSeatRefs.hallPreviewReady') }}
            </span>
          </button>
          <div
            v-for="number in coverage.missingOfficialHalls"
            :key="'missing-' + number"
            class="vieshow-hall-selector__tile vieshow-hall-selector__tile--missing"
            :aria-label="t('vieshowSeatRefs.missingHallAria', { number })"
          >
            <strong>{{ t('chainDetail.hallNumber', { number }) }}</strong>
            <small>{{ t('vieshowSeatRefs.hallStillMissing') }}</small>
          </div>
        </div>
      </div>
      <label class="seat-references__picker vieshow-hall-selector__compact">
        <span>{{ t('vieshowSeatRefs.quickSelect') }}</span>
        <select :value="activeId" @change="changeHall(($event.target as HTMLSelectElement).value)">
          <option v-for="item in candidates" :key="item.id" :value="item.id">
            {{ hallOption(item) }}
          </option>
        </select>
      </label>

      <template v-if="active">
        <div class="seat-references__facts">
          <span>{{ t('vieshowSeatRefs.regularSeats', { count: active.ordinarySeatCount }) }}</span>
          <span>{{
            t('vieshowSeatRefs.wheelchairMarkers', { count: active.wheelchairMarkers })
          }}</span>
          <span>{{ t('vieshowSeatRefs.checkedAt', { date: active.observedAt }) }}</span>
        </div>
        <p class="seat-references__notice" role="note">{{ countNotice }}</p>
        <RouterLink
          class="vieshow-3d-launch"
          :to="'/cinemas/' + cinemaSlug + '/halls/' + active.id"
        >
          <v-icon icon="mdi-cube-scan" size="20" />
          {{ t('vieshow3d.preview3d') }}
          <v-icon icon="mdi-chevron-right" size="17" />
        </RouterLink>
        <RouterLink
          v-if="cinemaSlug === 'vieshow-taipei-hsinyi' && active.hallNumber === 12"
          class="vieshow-hall-selector__archive"
          to="/auditoriums/vieshow-hsinyi-12"
        >
          <v-icon icon="mdi-archive-outline" size="17" />
          {{ t('vieshowSeatRefs.olderFestivalReference') }}
        </RouterLink>
        <p class="seat-references__caution">{{ t('vieshowSeatRefs.notice') }}</p>

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
                hall: active.hallLabel,
                count: active.ordinarySeatCount,
              })
            "
          >
            <text
              :x="mapWidth / 2"
              y="27"
              text-anchor="middle"
              class="seat-references__screen-label"
            >
              {{ t('vieshowSeatRefs.screenDirection') }}
            </text>
            <path :d="'M 55 38 L ' + (mapWidth - 55) + ' 38'" class="seat-references__screen" />
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
          <div v-for="row in rows" :key="row.visualRow">
            <strong>{{ row.rowLabel }}</strong>
            <span>{{ row.seats.join(' · ') }}</span>
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
    </template>
    <p v-else-if="!loading" role="status">{{ t('vieshowSeatRefs.noLayouts') }}</p>
  </section>
</template>
