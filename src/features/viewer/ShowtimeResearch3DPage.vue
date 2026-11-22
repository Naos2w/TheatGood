<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch, type Component } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { appLocale } from '../../composables/usePreferences'
import { neighbouringRowSeat, neighbouringSeat } from '../auditoriums/seat-navigation'
import { chainCinemas } from '../cinemas/chain-directory'
import { DEFAULT_ESTIMATED_SEAT_POV_HORIZONTAL_FOV } from '../cinemas/seat-screen-assumptions'
import {
  loadLocalShowtimeResearchHall,
  loadLocalShowtimeResearchIndex,
  type ShowtimeResearchHall,
} from './showtime-local-research'
import { deriveShowtimeEstimatedScene, type ShowtimeSeatSnapshot } from './showtime-estimated-scene'
import Cinema3DSeatTools from './Cinema3DSeatTools.vue'
import CinemaScreenMediaControls from './CinemaScreenMediaControls.vue'
import { swapObservedSeatComparison } from './seat-comparison'

const route = useRoute()
const router = useRouter()
const slug = computed(() => String(route.params.slug ?? ''))
const hallLabel = computed(() => String(route.params.hallId ?? ''))
const venue = computed(() =>
  chainCinemas.find((item) => item.slug === slug.value && item.brand === 'showtime'),
)
const english = computed(() => appLocale.value.startsWith('en'))
const halls = shallowRef<readonly ShowtimeResearchHall[]>([])
const source = shallowRef<ShowtimeSeatSnapshot | null>(null)
const loading = ref(true)
const unavailable = ref(false)
const seatId = ref('')
const mapZoom = ref(1)
const horizontalFov = ref(DEFAULT_ESTIMATED_SEAT_POV_HORIZONTAL_FOV)
const savedComparisonSeatId = ref('')
const mapScroller = ref<HTMLElement | null>(null)
const immersive = computed(() => route.query.view === '3d')
const viewMode = ref<'seat' | 'overview'>('seat')
const resetViewToken = ref(0)
const webglAvailable = ref(true)
const sceneFailed = ref(false)
const sceneComponent = shallowRef<Component | null>(null)
const screenVideo = shallowRef<HTMLVideoElement | null>(null)
function onScreenVideoElement(video: HTMLVideoElement | null) {
  screenVideo.value = video
}

const scene = computed(() =>
  source.value ? deriveShowtimeEstimatedScene(source.value, undefined, slug.value) : null,
)
const selected = computed(() => scene.value?.seats.find((item) => item.id === seatId.value) ?? null)
const previous = computed(() =>
  scene.value && selected.value ? neighbouringSeat(scene.value.seats, seatId.value, -1) : null,
)
const next = computed(() =>
  scene.value && selected.value ? neighbouringSeat(scene.value.seats, seatId.value, 1) : null,
)
const frontRow = computed(() =>
  scene.value ? neighbouringRowSeat(scene.value.seats, seatId.value, -1) : null,
)
const backRow = computed(() =>
  scene.value ? neighbouringRowSeat(scene.value.seats, seatId.value, 1) : null,
)
const sourceColumns = computed(
  () => source.value?.seatPositions.map((seat) => seat.gridColumn) ?? [],
)
const sourceRows = computed(() => source.value?.seatPositions.map((seat) => seat.gridRow) ?? [])
const minCol = computed(() => (sourceColumns.value.length ? Math.min(...sourceColumns.value) : 1))
const maxCol = computed(() => (sourceColumns.value.length ? Math.max(...sourceColumns.value) : 1))
const minRow = computed(() => (sourceRows.value.length ? Math.min(...sourceRows.value) : 1))
const maxRow = computed(() => (sourceRows.value.length ? Math.max(...sourceRows.value) : 1))
const cellSize = 30
const mapWidth = computed(() => Math.max(520, 112 + (maxCol.value - minCol.value + 1) * cellSize))
const mapHeight = computed(() => 115 + (maxRow.value - minRow.value + 1) * cellSize)
const screenLineWidth = computed(() => {
  const columns = maxCol.value - minCol.value + 1
  const occupiedWidth = columns * cellSize
  // Match the same estimated screen-to-seat-bank ratio used by the 3D scene.
  return Math.min(
    occupiedWidth * 0.96,
    occupiedWidth * (scene.value?.estimatedScreenToSeatBlockRatio ?? 0.86),
  )
})
const screenCentreX = computed(() => 56 + ((maxCol.value - minCol.value + 1) * cellSize) / 2)
const mapScaleWidth = computed(() => Math.round(mapWidth.value * mapZoom.value))
const mapScaleHeight = computed(() => Math.round(mapHeight.value * mapZoom.value))
const rowLabels = computed(() =>
  [
    ...new Map(
      (source.value?.seatPositions ?? []).map((seat) => [
        seat.gridRow,
        { row: seat.gridRow, label: seat.rowLabel ?? String(seat.gridRow) },
      ]),
    ).values(),
  ].sort((a, b) => a.row - b.row),
)

function mapX(column: number): number {
  return 56 + (column - minCol.value) * cellSize
}
function mapY(row: number): number {
  return 66 + (row - minRow.value) * cellSize
}

function initialSeat(): string {
  const seats = scene.value?.seats ?? []
  if (!seats.length) return ''
  const rows = [...new Set(seats.map((item) => item.z))].sort((a, b) => a - b)
  const central = rows[Math.floor(rows.length / 2)]!
  return [...seats].sort(
    (a, b) =>
      Math.abs(a.z - central) - Math.abs(b.z - central) ||
      Math.abs(a.x) - Math.abs(b.x) ||
      a.id.localeCompare(b.id),
  )[0]!.id
}

watch(
  [slug, hallLabel],
  async ([nextSlug, nextHall], _, onCleanup) => {
    const controller = new AbortController()
    onCleanup(() => controller.abort())
    loading.value = true
    unavailable.value = false
    source.value = null
    halls.value = []
    seatId.value = ''
    savedComparisonSeatId.value = ''
    mapZoom.value = 1
    viewMode.value = 'seat'
    try {
      const [index, snapshot] = await Promise.all([
        loadLocalShowtimeResearchIndex(nextSlug, controller.signal),
        loadLocalShowtimeResearchHall(nextSlug, nextHall, controller.signal),
      ])
      if (controller.signal.aborted) return
      halls.value = index.venues[nextSlug] ?? []
      source.value = snapshot
      const querySeat = route.query.seat
      const seatIds = new Set(snapshot.seatPositions.map((item) => item.label))
      seatId.value =
        typeof querySeat === 'string' && seatIds.has(querySeat) ? querySeat : initialSeat()
    } catch {
      if (!controller.signal.aborted) unavailable.value = true
    } finally {
      if (!controller.signal.aborted) loading.value = false
    }
  },
  { immediate: true },
)
watch(
  () => route.query.seat,
  (querySeat) => {
    if (typeof querySeat === 'string' && scene.value?.seats.some((item) => item.id === querySeat)) {
      seatId.value = querySeat
    }
  },
)
function assignScene(component: Component) {
  sceneComponent.value = component
}
async function load3D() {
  if (sceneComponent.value || sceneFailed.value || !webglAvailable.value) return
  try {
    assignScene((await import('./ThreeCinemaScene.vue')).default)
  } catch {
    sceneFailed.value = true
  }
}
watch(immersive, (value) => {
  if (value) void load3D()
})
onMounted(() => {
  try {
    webglAvailable.value = Boolean(document.createElement('canvas').getContext('webgl2'))
  } catch {
    webglAvailable.value = false
  }
  if (immersive.value && webglAvailable.value) void load3D()
})

function selectSeat(id: string) {
  if (!scene.value?.seats.some((item) => item.id === id)) return
  seatId.value = id
  void router.replace({ query: { ...route.query, seat: id } })
}
function adjacent(direction: -1 | 1) {
  const item = direction < 0 ? previous.value : next.value
  if (item) selectSeat(item.id)
}
function adjacentRow(direction: -1 | 1) {
  const item = direction < 0 ? frontRow.value : backRow.value
  if (item) selectSeat(item.id)
}
function swapComparison() {
  if (!scene.value) return
  const swapped = swapObservedSeatComparison(
    scene.value.seats,
    seatId.value,
    savedComparisonSeatId.value,
  )
  if (!swapped) return
  savedComparisonSeatId.value = swapped.nextSaved
  selectSeat(swapped.nextSelected)
}
function switchHall(label: string) {
  if (!halls.value.some((item) => item.hallLabel === label)) return
  void router.push({ path: '/cinemas/' + slug.value + '/halls/' + encodeURIComponent(label) })
}
function set3D(value: boolean) {
  void router.replace({
    query: { ...route.query, view: value ? '3d' : undefined, seat: seatId.value },
  })
}
function zoom(delta: number) {
  mapZoom.value = Math.max(1, Math.min(1.75, Math.round((mapZoom.value + delta) * 100) / 100))
}
function selectedMapSeatLabel(): string {
  return seatId.value || (english.value ? 'None' : '尚未選位')
}
</script>

<template>
  <main class="container showtime-3d-page" :class="{ 'viewer-page--immersive': immersive }">
    <section v-if="loading" class="showtime-3d-page__status" role="status">
      <v-progress-circular indeterminate color="primary" size="38" />
      {{ english ? 'Loading verified local auditorium research…' : '讀取已驗證的本機影廳資料…' }}
    </section>
    <section
      v-else-if="unavailable || !source || !scene || !venue"
      class="showtime-3d-page__status"
      role="status"
    >
      <v-icon icon="mdi-shield-lock-outline" size="27" aria-hidden="true" />
      <p>
        {{
          english
            ? 'This hall has no locally verified seat layout available in the MSI development environment. Private research is never distributed with the public site.'
            : '此影廳的完整座位格線尚未在 MSI 本機研究環境開放，私有座圖不包含在公開網站中。'
        }}
      </p>
      <RouterLink :to="'/cinemas/' + slug">{{
        english ? 'Back to cinema' : '返回影城'
      }}</RouterLink>
    </section>
    <template v-else>
      <section v-show="!immersive">
        <RouterLink class="back-link" :to="'/cinemas/' + slug + '#showtime-local-3d-research'">
          <v-icon icon="mdi-chevron-left" size="19" aria-hidden="true" />
          {{ english ? 'Back to cinema' : '返回影城' }}
        </RouterLink>
        <header class="showtime-3d-page__header">
          <div>
            <span class="showtime-3d-page__eyebrow">
              {{ english ? 'Private research · Estimated 3D' : '本機研究 · 估算 3D' }}
            </span>
            <h1>
              {{ venue.name }} <span>· {{ source.observedHallLabel }}</span>
            </h1>
            <p>
              {{ source.ordinarySeatCount }} {{ english ? 'observed seat IDs' : '個來源座號' }} ·
              {{ source.rowsCount }} {{ english ? 'rows' : '排' }}
            </p>
          </div>
          <label class="showtime-3d-page__hall-selector">
            {{ english ? 'Hall' : '切換影廳' }}
            <select
              :value="source.observedHallLabel"
              @change="switchHall(($event.target as HTMLSelectElement).value)"
            >
              <option v-for="item in halls" :key="item.hallLabel" :value="item.hallLabel">
                {{ item.hallLabel }} · {{ item.ordinarySeatCount }}
              </option>
            </select>
          </label>
        </header>
        <p class="showtime-3d-page__disclaimer" role="note">
          <v-icon icon="mdi-information-outline" size="18" aria-hidden="true" />
          {{
            english
              ? 'Original seat labels and relative row/aisle gaps; screen size, seating pitch, rake and 3D distances are estimates. No verified wheelchair map.'
              : '僅座號與相對排／列、走道空缺來自已核對來源；銀幕尺寸、座距、階梯高度與 3D 距離均為估算，輪椅席配置尚未驗證。'
          }}
        </p>
        <section class="showtime-3d-page__seat-section">
          <div class="showtime-3d-page__map-heading">
            <h2>{{ english ? 'Choose your seat' : '選擇座位' }}</h2>
            <div class="showtime-3d-page__zoom" :aria-label="english ? 'Map zoom' : '座位圖縮放'">
              <button
                :disabled="mapZoom <= 1"
                @click="zoom(-0.25)"
                :aria-label="english ? 'Zoom out' : '縮小'"
              >
                −
              </button>
              <button @click="mapZoom = 1" :aria-label="english ? 'Reset zoom' : '重設縮放'">
                {{ Math.round(mapZoom * 100) }}%
              </button>
              <button
                :disabled="mapZoom >= 1.75"
                @click="zoom(0.25)"
                :aria-label="english ? 'Zoom in' : '放大'"
              >
                +
              </button>
            </div>
          </div>
          <div
            ref="mapScroller"
            class="showtime-3d-page__map-scroll"
            tabindex="0"
            :aria-label="english ? 'Scrollable seat map' : '可捲動的座位圖'"
          >
            <svg
              :viewBox="'0 0 ' + mapWidth + ' ' + mapHeight"
              :width="mapScaleWidth"
              :height="mapScaleHeight"
              role="group"
              :aria-label="source.observedHallLabel + ' ' + source.ordinarySeatCount"
            >
              <text
                class="showtime-3d-page__screen-label"
                :x="screenCentreX"
                y="24"
                text-anchor="middle"
              >
                {{ english ? 'SCREEN' : '銀幕方向' }}
              </text>
              <path
                class="showtime-3d-page__screen-line"
                :d="
                  'M ' +
                  (screenCentreX - screenLineWidth / 2) +
                  ' 34 L ' +
                  (screenCentreX + screenLineWidth / 2) +
                  ' 34'
                "
              />
              <g v-for="row in rowLabels" :key="'row-' + row.row">
                <text
                  class="showtime-3d-page__row-label"
                  x="32"
                  :y="mapY(row.row) + 16"
                  text-anchor="middle"
                >
                  {{ row.label }}
                </text>
              </g>
              <g
                v-for="seat in source.seatPositions"
                :key="seat.label"
                class="showtime-3d-page__seat"
                role="button"
                tabindex="0"
                :aria-label="seat.label"
                :aria-pressed="seatId === seat.label"
                @click="selectSeat(seat.label)"
                @keydown.enter.prevent="selectSeat(seat.label)"
                @keydown.space.prevent="selectSeat(seat.label)"
              >
                <title>{{ seat.label }}</title>
                <rect
                  :x="mapX(seat.gridColumn)"
                  :y="mapY(seat.gridRow)"
                  width="25"
                  height="25"
                  rx="5"
                  :class="{ 'showtime-3d-page__seat--selected': seatId === seat.label }"
                />
                <text
                  :x="mapX(seat.gridColumn) + 12.5"
                  :y="mapY(seat.gridRow) + 16"
                  text-anchor="middle"
                  pointer-events="none"
                >
                  {{ seat.seatNumber }}
                </text>
              </g>
            </svg>
          </div>
          <div class="showtime-3d-page__actions">
            <label>
              {{ english ? 'Selected seat' : '目前座位' }}
              <select
                :value="seatId"
                @change="selectSeat(($event.target as HTMLSelectElement).value)"
              >
                <option v-for="seat in source.seatPositions" :key="seat.label" :value="seat.label">
                  {{ seat.label }}
                </option>
              </select>
            </label>
            <button type="button" class="button-primary" :disabled="!seatId" @click="set3D(true)">
              <v-icon icon="mdi-cube-scan" size="20" aria-hidden="true" />
              {{ english ? 'View from this seat in 3D' : '從這個座位看 3D 視角' }}
            </button>
          </div>
        </section>
      </section>

      <div v-if="immersive" class="viewer-immersive showtime-3d-page__immersive">
        <div v-if="!webglAvailable || sceneFailed" class="viewer-immersive__fallback" role="status">
          {{
            english
              ? 'WebGL 3D is unavailable. Use the 2D map instead.'
              : '目前無法使用 WebGL 3D，請返回 2D 座位圖。'
          }}
        </div>
        <div v-else-if="!sceneComponent" class="viewer-immersive__fallback" role="status">
          {{ english ? 'Loading 3D auditorium…' : '正在載入 3D 影廳…' }}
        </div>
        <component
          :is="sceneComponent"
          v-else
          :key="source.cinemaSlug + ':' + source.observedHallLabel"
          :auditorium="scene.auditorium"
          :seats="scene.seats"
          :wheelchair-spots="scene.wheelchairSpots"
          :selected-seat-id="seatId"
          :reset-view-token="resetViewToken"
          :horizontal-fov="horizontalFov"
          :view-mode="viewMode"
          :demo-video="screenVideo"
        />
        <div class="viewer-immersive__top">
          <button class="viewer-glass-button" type="button" @click="set3D(false)">
            <v-icon icon="mdi-chevron-left" size="20" aria-hidden="true" />
            {{ english ? 'Back to map' : '返回座位圖' }}
          </button>
          <span class="viewer-glass-button viewer-immersive__seat">
            {{ source.observedHallLabel }} · {{ selectedMapSeatLabel() }}
          </span>
        </div>
        <div class="viewer-immersive__adjustments">
          <Cinema3DSeatTools
            :horizontal-fov="horizontalFov"
            :can-move-front="!!frontRow"
            :can-move-back="!!backRow"
            :english="english"
            :selected-seat-id="seatId"
            :saved-comparison-seat-id="savedComparisonSeatId"
            @update:horizontal-fov="horizontalFov = $event"
            @move-row="adjacentRow"
            @save-comparison="savedComparisonSeatId = seatId"
            @swap-comparison="swapComparison"
            @clear-comparison="savedComparisonSeatId = ''"
          />
        </div>
        <div class="viewer-immersive__bottom">
          <p class="viewer-immersive__hint">
            {{
              english ? 'Estimated geometry · drag to look around' : '概念空間估算 · 拖曳可轉動視角'
            }}
          </p>
          <div class="viewer-switcher glass-panel">
            <button
              :disabled="!previous"
              :aria-label="english ? 'Previous seat' : '上一席'"
              @click="adjacent(-1)"
            >
              <v-icon icon="mdi-chevron-left" size="30" aria-hidden="true" />
            </button>
            <div class="viewer-switcher__seat" aria-live="polite">
              <strong>{{ seatId }}</strong>
              <span>{{
                viewMode === 'overview'
                  ? english
                    ? 'Overview'
                    : '影廳概覽'
                  : english
                    ? 'Seat perspective'
                    : '第一人稱視角'
              }}</span>
            </div>
            <button
              :disabled="!next"
              :aria-label="english ? 'Next seat' : '下一席'"
              @click="adjacent(1)"
            >
              <v-icon icon="mdi-chevron-right" size="30" aria-hidden="true" />
            </button>
          </div>
          <div class="viewer-immersive__utility viewer-immersive__utility--media">
            <CinemaScreenMediaControls
              v-if="webglAvailable && !sceneFailed && sceneComponent"
              :english="english"
              @video-element="onScreenVideoElement"
            />
            <button type="button" class="viewer-reset" @click="resetViewToken++">
              <v-icon icon="mdi-restore" size="19" aria-hidden="true" />
              {{ english ? 'Reset view' : '重設視角' }}
            </button>
            <button
              type="button"
              class="viewer-reset"
              @click="viewMode = viewMode === 'seat' ? 'overview' : 'seat'"
            >
              <v-icon
                :icon="
                  viewMode === 'seat' ? 'mdi-view-dashboard-outline' : 'mdi-seat-recline-normal'
                "
                size="19"
                aria-hidden="true"
              />
              {{
                viewMode === 'seat'
                  ? english
                    ? 'Overview'
                    : '影廳概覽'
                  : english
                    ? 'Seat view'
                    : '座位視角'
              }}
            </button>
          </div>
        </div>
      </div>
    </template>
  </main>
</template>

<style scoped>
.showtime-3d-page {
  padding-top: 20px;
  padding-bottom: 64px;
}
.showtime-3d-page__status {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  flex-wrap: wrap;
  padding: 70px 18px;
  text-align: center;
}
.showtime-3d-page__status p {
  max-width: 540px;
  margin: 0;
}
.showtime-3d-page__header {
  display: flex;
  gap: 22px;
  justify-content: space-between;
  align-items: end;
  margin: 22px 0 16px;
}
.showtime-3d-page__header h1 {
  margin: 5px 0 6px;
  font-size: clamp(21px, 3.3vw, 31px);
  line-height: 1.35;
}
.showtime-3d-page__header h1 span {
  color: rgba(var(--v-theme-on-surface), 0.64);
}
.showtime-3d-page__header p {
  margin: 0;
  opacity: 0.76;
}
.showtime-3d-page__eyebrow {
  font-size: 12px;
  letter-spacing: 0.08em;
  font-weight: 700;
  opacity: 0.7;
}
.showtime-3d-page__hall-selector {
  display: grid;
  gap: 7px;
  font-size: 13px;
  font-weight: 600;
  min-width: 150px;
}
.showtime-3d-page select {
  padding: 10px 12px;
  max-width: 100%;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.22);
  border-radius: 12px;
  color: inherit;
  background: rgba(var(--v-theme-surface), 0.94);
  font: inherit;
}
.showtime-3d-page__disclaimer {
  display: flex;
  align-items: start;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 14px;
  background: rgba(var(--v-theme-surface-variant), 0.14);
  font-size: 13px;
  line-height: 1.65;
}
.showtime-3d-page__disclaimer .v-icon {
  flex: 0 0 auto;
  margin-top: 2px;
}
.showtime-3d-page__seat-section {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 21px;
  padding: 16px;
  background: rgba(var(--v-theme-surface), 0.82);
}
.showtime-3d-page__map-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
}
.showtime-3d-page__map-heading h2 {
  font-size: 19px;
}
.showtime-3d-page__zoom {
  display: flex;
  align-items: stretch;
  gap: 5px;
}
.showtime-3d-page__zoom button {
  min-width: 34px;
  padding: 6px 8px;
  border-radius: 9px;
  background: rgba(var(--v-theme-on-surface), 0.06);
}
.showtime-3d-page__zoom button:disabled {
  opacity: 0.3;
}
.showtime-3d-page__map-scroll {
  width: 100%;
  max-height: min(64vh, 680px);
  min-height: 260px;
  overflow: auto;
  overscroll-behavior: contain;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  border-radius: 14px;
  background: rgba(var(--v-theme-on-surface), 0.022);
}
.showtime-3d-page__map-scroll svg {
  display: block;
  margin: 0 auto;
}
.showtime-3d-page__screen-line {
  stroke: #889db5;
  stroke-width: 6;
  stroke-linecap: round;
}
.showtime-3d-page__screen-label {
  fill: currentColor;
  font-size: 13px;
  font-weight: 700;
}
.showtime-3d-page__row-label {
  fill: currentColor;
  font-size: 11px;
  opacity: 0.64;
}
.showtime-3d-page__seat {
  cursor: pointer;
  outline: none;
}
.showtime-3d-page__seat rect {
  fill: #70849a;
  stroke: rgba(19, 29, 43, 0.46);
  stroke-width: 1;
}
.showtime-3d-page__seat text {
  fill: #fff;
  font-size: 11px;
  font-weight: 600;
}
.showtime-3d-page__seat--selected {
  fill: #b2763b !important;
  stroke: #e9cc99 !important;
  stroke-width: 2.1 !important;
}
.showtime-3d-page__seat:focus rect,
.showtime-3d-page__seat:hover rect {
  stroke: #d6a76a;
  stroke-width: 2.5;
}
.showtime-3d-page__actions {
  display: flex;
  align-items: end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 18px;
}
.showtime-3d-page__actions label {
  display: grid;
  gap: 7px;
  font-size: 13px;
  font-weight: 600;
}
.showtime-3d-page__actions .button-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  border-radius: 13px;
  padding: 11px 20px;
  min-height: 44px;
}
.showtime-3d-page__immersive {
  position: fixed;
  inset: 0;
  z-index: 100;
}
@media (max-width: 640px) {
  .showtime-3d-page {
    padding: 12px 0 35px;
  }
  .showtime-3d-page__header {
    align-items: stretch;
    flex-direction: column;
    gap: 12px;
  }
  .showtime-3d-page__hall-selector {
    min-width: 0;
    width: min(100%, 340px);
  }
  .showtime-3d-page__seat-section {
    padding: 10px;
    border-radius: 14px;
  }
  .showtime-3d-page__map-scroll {
    min-height: 235px;
    max-height: 53vh;
  }
  .showtime-3d-page__actions {
    align-items: stretch;
  }
  .showtime-3d-page__actions label,
  .showtime-3d-page__actions .button-primary {
    width: 100%;
  }
}
@media (prefers-reduced-motion: reduce) {
  .showtime-3d-page__seat {
    transition: none;
  }
}
</style>
