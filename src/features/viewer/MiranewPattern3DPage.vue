<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch, type Component } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { appLocale } from '../../composables/usePreferences'
import { neighbouringRowSeat, neighbouringSeat } from '../auditoriums/seat-navigation'
import {
  isReferenceSpecialSeat,
  seatLayoutReferenceById,
  seatLayoutReferencesForCinema,
} from '../cinemas/official-seat-layouts'
import { chainCinemas } from '../cinemas/chain-directory'
import { DEFAULT_ESTIMATED_SEAT_POV_HORIZONTAL_FOV } from '../cinemas/seat-screen-assumptions'
import { deriveMiranewPattern3D, initialMiranewPatternSeat } from './miranew-pattern-3d'
import Cinema3DSeatTools from './Cinema3DSeatTools.vue'
import CinemaScreenMediaControls from './CinemaScreenMediaControls.vue'
import { swapObservedSeatComparison } from './seat-comparison'

const route = useRoute()
const router = useRouter()
const slug = computed(() => String(route.params.slug ?? ''))
const patternId = computed(() => String(route.params.patternId ?? ''))
const reference = computed(() => {
  const found = seatLayoutReferenceById(patternId.value)
  return found?.cinemaSlug === slug.value ? found : undefined
})
const venue = computed(() => chainCinemas.find((x) => x.slug === slug.value))
const layouts = computed(() => seatLayoutReferencesForCinema(slug.value))
const english = computed(() => appLocale.value.startsWith('en'))
const model = computed(() => (reference.value ? deriveMiranewPattern3D(reference.value) : null))
const selectedId = ref('')
const selected = computed(() => model.value?.seats.find((item) => item.id === selectedId.value))
const previous = computed(() =>
  model.value && selected.value ? neighbouringSeat(model.value.seats, selectedId.value, -1) : null,
)
const next = computed(() =>
  model.value && selected.value ? neighbouringSeat(model.value.seats, selectedId.value, 1) : null,
)
const frontRow = computed(() =>
  model.value ? neighbouringRowSeat(model.value.seats, selectedId.value, -1) : null,
)
const backRow = computed(() =>
  model.value ? neighbouringRowSeat(model.value.seats, selectedId.value, 1) : null,
)
const immersive = computed(() => route.query.view === '3d')
const viewMode = ref<'seat' | 'overview'>('seat')
const resetViewToken = ref(0)
const sceneComponent = shallowRef<Component | null>(null)
const screenVideo = shallowRef<HTMLVideoElement | null>(null)
function onScreenVideoElement(video: HTMLVideoElement | null) {
  screenVideo.value = video
}
const sceneFailed = ref(false)
const webglAvailable = ref(true)
const zoom = ref(1)
const horizontalFov = ref(DEFAULT_ESTIMATED_SEAT_POV_HORIZONTAL_FOV)
const savedComparisonSeatId = ref('')
const xs = computed(() => reference.value?.seatPositions.map((item) => item[2]) ?? [])
const ys = computed(() => reference.value?.seatPositions.map((item) => item[1]) ?? [])
const minX = computed(() => (xs.value.length ? Math.min(...xs.value) : 1))
const minY = computed(() => (ys.value.length ? Math.min(...ys.value) : 1))
const maxX = computed(() => (xs.value.length ? Math.max(...xs.value) : 1))
const maxY = computed(() => (ys.value.length ? Math.max(...ys.value) : 1))
const width = computed(() => Math.max(520, 110 + (maxX.value - minX.value + 1) * 30))
const height = computed(() => 106 + (maxY.value - minY.value + 1) * 30)
const screenLine = computed(() =>
  Math.min(width.value - 110, (maxX.value - minX.value + 1) * 30 * 0.86),
)
const cx = computed(() => 55 + ((maxX.value - minX.value + 1) * 30) / 2)
const x = (col: number) => 55 + (col - minX.value) * 30
const y = (row: number) => 63 + (row - minY.value) * 30

watch(
  [patternId, () => route.query.seat],
  ([nextPattern, seat]) => {
    const source = seatLayoutReferenceById(nextPattern)
    if (!source || source.cinemaSlug !== slug.value || !model.value) {
      selectedId.value = ''
      return
    }
    const selectedSeatExists =
      typeof seat === 'string' && model.value.seats.some((item) => item.id === seat)
    selectedId.value = selectedSeatExists ? seat : initialMiranewPatternSeat(model.value)
  },
  { immediate: true },
)
watch([slug, patternId], () => {
  zoom.value = 1
  savedComparisonSeatId.value = ''
})
async function loadScene() {
  if (sceneComponent.value || sceneFailed.value || !webglAvailable.value) return
  try {
    assignScene((await import('./ThreeCinemaScene.vue')).default)
  } catch {
    sceneFailed.value = true
  }
}
function assignScene(component: Component) {
  sceneComponent.value = component
}
watch(immersive, (value) => {
  if (value) void loadScene()
})
onMounted(() => {
  try {
    webglAvailable.value = Boolean(document.createElement('canvas').getContext('webgl2'))
  } catch {
    webglAvailable.value = false
  }
  if (immersive.value) void loadScene()
})
function selectSeat(value: string) {
  if (!model.value?.seats.some((seat) => seat.id === value)) return
  selectedId.value = value
  void router.replace({ query: { ...route.query, seat: value } })
}
function changePattern(id: string) {
  if (!layouts.value.some((item) => item.id === id)) return
  void router.push('/cinemas/' + slug.value + '/seat-patterns/' + id)
}
function setImmersive(value: boolean) {
  void router.replace({
    query: { ...route.query, view: value ? '3d' : undefined, seat: selectedId.value },
  })
}
function move(direction: -1 | 1) {
  const target = direction < 0 ? previous.value : next.value
  if (target) selectSeat(target.id)
}
function moveRow(direction: -1 | 1) {
  const target = direction < 0 ? frontRow.value : backRow.value
  if (target) selectSeat(target.id)
}
function swapComparison() {
  if (!model.value) return
  const swapped = swapObservedSeatComparison(
    model.value.seats,
    selectedId.value,
    savedComparisonSeatId.value,
  )
  if (!swapped) return
  savedComparisonSeatId.value = swapped.nextSaved
  selectSeat(swapped.nextSelected)
}
function zoomMap(delta: number) {
  zoom.value = Math.min(1.75, Math.max(1, Math.round((zoom.value + delta) * 100) / 100))
}
</script>

<template>
  <main class="container miranew-pattern-3d" :class="{ 'viewer-page--immersive': immersive }">
    <section v-if="!reference || !venue || !model" class="miranew-pattern-3d__empty" role="status">
      {{ english ? 'This unnumbered pattern is not available.' : '找不到已核對的座型參考。' }}
      <RouterLink :to="'/cinemas/' + slug">{{
        english ? 'Back to cinema' : '返回影城'
      }}</RouterLink>
    </section>
    <template v-else>
      <section v-show="!immersive">
        <RouterLink :to="'/cinemas/' + slug" class="back-link">
          <v-icon icon="mdi-chevron-left" size="19" aria-hidden="true" />
          {{ english ? 'Back to cinema' : '返回影城' }}
        </RouterLink>
        <header class="miranew-pattern-3d__heading">
          <div>
            <span class="miranew-pattern-3d__eyebrow">
              {{ english ? 'Observed seat pattern · Estimated 3D' : '來源座型研究 · 估算 3D' }}
            </span>
            <h1>
              {{ venue.name }} <span>· {{ reference.publishedHallLabel }}</span>
            </h1>
            <p>
              {{ reference.totalSeatLabels }} {{ english ? 'observed seat labels' : '個觀察座號' }}
            </p>
          </div>
          <label class="miranew-pattern-3d__pattern-select">
            {{ english ? 'Select observed pattern' : '切換座型樣本' }}
            <select
              :value="patternId"
              @change="changePattern(($event.target as HTMLSelectElement).value)"
            >
              <option v-for="(item, index) in layouts" :key="item.id" :value="item.id">
                {{ item.publishedHallLabel }} {{ index + 1 }} · {{ item.totalSeatLabels }}
                {{ english ? 'seats' : '座' }}
              </option>
            </select>
          </label>
        </header>
        <p class="miranew-pattern-3d__disclaimer" role="note">
          <v-icon icon="mdi-information-outline" aria-hidden="true" size="19" />
          {{
            english
              ? 'This is a verified public seat-chart pattern, NOT a confirmed permanent hall number. Seat IDs and relative gaps are observed; screen, row pitch, rake and 3D scale are estimates. W-labelled special-seat positions are not an independently surveyed accessible layout.'
              : '此為官方公開場次觀察到的座位排列「樣本」，尚未確認永久實體廳號。座號與相對走道保留來源；銀幕、行距、坡度與空間尺度均為估算。W 特殊座號不是經實地測量的無障礙配置。'
          }}
        </p>
        <section class="miranew-pattern-3d__map-panel">
          <div class="miranew-pattern-3d__toolbar">
            <h2>{{ english ? 'Choose a seat' : '選擇座位' }}</h2>
            <div class="miranew-pattern-3d__zoom">
              <button
                :disabled="zoom <= 1"
                :aria-label="english ? 'Zoom out' : '縮小'"
                @click="zoomMap(-0.25)"
              >
                −
              </button>
              <button :aria-label="english ? 'Reset zoom' : '重設縮放'" @click="zoom = 1">
                {{ Math.round(zoom * 100) }}%
              </button>
              <button
                :disabled="zoom >= 1.75"
                :aria-label="english ? 'Zoom in' : '放大'"
                @click="zoomMap(0.25)"
              >
                +
              </button>
            </div>
          </div>
          <div
            class="miranew-pattern-3d__scroll"
            tabindex="0"
            :aria-label="english ? 'Scrollable source seat map' : '可捲動的來源座位圖'"
          >
            <svg
              :viewBox="'0 0 ' + width + ' ' + height"
              :width="Math.round(width * zoom)"
              :height="Math.round(height * zoom)"
              role="group"
              :aria-label="reference.publishedHallLabel + ' ' + reference.totalSeatLabels"
            >
              <text :x="cx" y="24" text-anchor="middle" class="miranew-pattern-3d__screen-label">
                {{ english ? 'SCREEN' : '銀幕方向' }}
              </text>
              <path
                class="miranew-pattern-3d__screen"
                :d="'M ' + (cx - screenLine / 2) + ' 34 L ' + (cx + screenLine / 2) + ' 34'"
              />
              <g
                v-for="seat in reference.seatPositions"
                :key="seat[0]"
                role="button"
                tabindex="0"
                class="miranew-pattern-3d__seat"
                :aria-label="seat[0]"
                :aria-pressed="selectedId === seat[0]"
                @click="selectSeat(seat[0])"
                @keydown.enter.prevent="selectSeat(seat[0])"
                @keydown.space.prevent="selectSeat(seat[0])"
              >
                <title>{{ seat[0] }}</title>
                <rect
                  :x="x(seat[2])"
                  :y="y(seat[1])"
                  width="25"
                  height="25"
                  rx="5"
                  :class="{
                    'miranew-pattern-3d__special': isReferenceSpecialSeat(seat[0]),
                    'miranew-pattern-3d__selected': selectedId === seat[0],
                  }"
                />
                <text
                  :x="x(seat[2]) + 12.5"
                  :y="y(seat[1]) + 16"
                  text-anchor="middle"
                  pointer-events="none"
                >
                  {{ seat[0] }}
                </text>
              </g>
            </svg>
          </div>
          <div class="miranew-pattern-3d__actions">
            <label>
              {{ english ? 'Seat' : '座位' }}
              <select
                :value="selectedId"
                @change="selectSeat(($event.target as HTMLSelectElement).value)"
              >
                <option v-for="seat in reference.seatPositions" :key="seat[0]" :value="seat[0]">
                  {{ seat[0] }}
                </option>
              </select>
            </label>
            <button
              class="button-primary"
              type="button"
              :disabled="!selectedId"
              @click="setImmersive(true)"
            >
              <v-icon icon="mdi-cube-scan" size="20" aria-hidden="true" />
              {{ english ? 'See estimated 3D view' : '開啟估算 3D 視角' }}
            </button>
          </div>
        </section>
      </section>
      <div v-if="immersive" class="viewer-immersive miranew-pattern-3d__immersive">
        <div v-if="!webglAvailable || sceneFailed" class="viewer-immersive__fallback" role="status">
          {{
            english
              ? '3D WebGL is unavailable; use the 2D seat map.'
              : 'WebGL 暫無法使用，請返回 2D 座位圖。'
          }}
        </div>
        <div v-else-if="!sceneComponent" class="viewer-immersive__fallback" role="status">
          {{ english ? 'Loading estimated 3D scene…' : '正在載入估算 3D 場景…' }}
        </div>
        <component
          :is="sceneComponent"
          v-else
          :key="reference.id"
          :auditorium="model.auditorium"
          :seats="model.seats"
          :wheelchair-spots="model.wheelchairSpots"
          :selected-seat-id="selectedId"
          :reset-view-token="resetViewToken"
          :horizontal-fov="horizontalFov"
          :view-mode="viewMode"
          :demo-video="screenVideo"
        />
        <div class="viewer-immersive__top">
          <button class="viewer-glass-button" type="button" @click="setImmersive(false)">
            <v-icon icon="mdi-chevron-left" size="20" aria-hidden="true" />
            {{ english ? 'Back to map' : '返回座位圖' }}
          </button>
          <span class="viewer-glass-button viewer-immersive__seat"
            >{{ reference.publishedHallLabel }} · {{ selectedId }}</span
          >
        </div>
        <div class="viewer-immersive__adjustments viewer-immersive__adjustments--media">
          <CinemaScreenMediaControls
            v-if="webglAvailable && !sceneFailed && sceneComponent"
            :english="english"
            @video-element="onScreenVideoElement"
          />
          <Cinema3DSeatTools
            :horizontal-fov="horizontalFov"
            :can-move-front="!!frontRow"
            :can-move-back="!!backRow"
            :english="english"
            :selected-seat-id="selectedId"
            :saved-comparison-seat-id="savedComparisonSeatId"
            @update:horizontal-fov="horizontalFov = $event"
            @move-row="moveRow"
            @save-comparison="savedComparisonSeatId = selectedId"
            @swap-comparison="swapComparison"
            @clear-comparison="savedComparisonSeatId = ''"
          />
        </div>
        <div class="viewer-immersive__bottom">
          <p class="viewer-immersive__hint">
            {{
              english
                ? 'Observed pattern · estimated dimensions'
                : '座型來源已核對 · 空間尺寸為估算'
            }}
          </p>
          <div class="viewer-switcher glass-panel">
            <button
              :disabled="!previous"
              :aria-label="english ? 'Previous seat' : '上一席'"
              @click="move(-1)"
            >
              <v-icon icon="mdi-chevron-left" size="30" aria-hidden="true" />
            </button>
            <div class="viewer-switcher__seat" aria-live="polite">
              <strong>{{ selectedId }}</strong>
              <span>{{
                viewMode === 'overview'
                  ? english
                    ? 'Overview'
                    : '全廳概覽'
                  : english
                    ? 'Seat view'
                    : '座位第一人稱'
              }}</span>
            </div>
            <button
              :disabled="!next"
              :aria-label="english ? 'Next seat' : '下一席'"
              @click="move(1)"
            >
              <v-icon icon="mdi-chevron-right" size="30" aria-hidden="true" />
            </button>
          </div>
          <div class="viewer-immersive__utility">
            <button class="viewer-reset" type="button" @click="resetViewToken++">
              <v-icon icon="mdi-restore" size="19" aria-hidden="true" />
              {{ english ? 'Reset' : '重設視角' }}
            </button>
            <button
              class="viewer-reset"
              type="button"
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
.miranew-pattern-3d {
  padding-block: 22px 64px;
}
.miranew-pattern-3d__heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 18px;
  margin: 24px 0 18px;
}
.miranew-pattern-3d__heading h1 {
  font-size: clamp(21px, 3.5vw, 29px);
  margin: 4px 0;
  line-height: 1.4;
}
.miranew-pattern-3d__heading h1 span {
  opacity: 0.75;
}
.miranew-pattern-3d__heading p {
  opacity: 0.7;
  margin: 0;
}
.miranew-pattern-3d__eyebrow {
  font-size: 13px;
  font-weight: 700;
  opacity: 0.68;
  letter-spacing: 0.04em;
}
.miranew-pattern-3d__pattern-select {
  display: grid;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  min-width: 180px;
}
.miranew-pattern-3d select {
  color: inherit;
  background: rgba(var(--v-theme-surface), 0.93);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.18);
  border-radius: 10px;
  font: inherit;
  padding: 10px;
}
.miranew-pattern-3d__disclaimer {
  display: flex;
  gap: 9px;
  font-size: 13px;
  padding: 13px;
  margin-block: 14px;
  line-height: 1.6;
  border-radius: 13px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.15);
  background: rgba(var(--v-theme-on-surface), 0.035);
}
.miranew-pattern-3d__disclaimer .v-icon {
  flex: 0 0 auto;
}
.miranew-pattern-3d__map-panel {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.13);
  border-radius: 18px;
  padding: 14px;
}
.miranew-pattern-3d__toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.miranew-pattern-3d__toolbar h2 {
  font-size: 19px;
}
.miranew-pattern-3d__zoom {
  display: flex;
  gap: 5px;
}
.miranew-pattern-3d__zoom button {
  padding: 6px 10px;
  border-radius: 9px;
  background: rgba(var(--v-theme-on-surface), 0.08);
}
.miranew-pattern-3d__zoom button:disabled {
  opacity: 0.3;
}
.miranew-pattern-3d__scroll {
  overflow: auto;
  min-height: 245px;
  max-height: min(60vh, 640px);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.13);
  border-radius: 12px;
  overscroll-behavior: contain;
}
.miranew-pattern-3d__scroll svg {
  display: block;
  margin: 0 auto;
}
.miranew-pattern-3d__screen-label {
  font-size: 13px;
  font-weight: 700;
  fill: currentColor;
}
.miranew-pattern-3d__screen {
  stroke: #899bb0;
  stroke-width: 6;
  stroke-linecap: round;
}
.miranew-pattern-3d__seat {
  cursor: pointer;
  outline: none;
}
.miranew-pattern-3d__seat rect {
  fill: #71879f;
  stroke: #273344;
  stroke-width: 1;
}
.miranew-pattern-3d__seat text {
  font-size: 9px;
  font-weight: 600;
  fill: white;
}
.miranew-pattern-3d__seat .miranew-pattern-3d__special {
  fill: #b89666;
}
.miranew-pattern-3d__seat .miranew-pattern-3d__selected {
  fill: #b47b38;
  stroke: #f3d3a8;
  stroke-width: 2.2;
}
.miranew-pattern-3d__seat:hover rect,
.miranew-pattern-3d__seat:focus rect {
  stroke: #f3d3a8;
  stroke-width: 2.2;
}
.miranew-pattern-3d__actions {
  display: flex;
  gap: 15px;
  justify-content: space-between;
  align-items: end;
  flex-wrap: wrap;
  margin-top: 16px;
}
.miranew-pattern-3d__actions label {
  display: grid;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
}
.miranew-pattern-3d__actions .button-primary {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
  padding: 11px 18px;
  border-radius: 12px;
}
.miranew-pattern-3d__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
  padding: 65px 16px;
  text-align: center;
}
.miranew-pattern-3d__immersive {
  position: fixed;
  inset: 0;
  z-index: 100;
}
@media (max-width: 650px) {
  .miranew-pattern-3d__heading {
    flex-direction: column;
    align-items: start;
    gap: 12px;
  }
  .miranew-pattern-3d__pattern-select {
    width: min(100%, 340px);
  }
  .miranew-pattern-3d__map-panel {
    padding: 9px;
  }
  .miranew-pattern-3d__scroll {
    max-height: 54vh;
  }
  .miranew-pattern-3d__actions {
    align-items: stretch;
  }
  .miranew-pattern-3d__actions label,
  .miranew-pattern-3d__actions button {
    width: 100%;
  }
}
</style>
