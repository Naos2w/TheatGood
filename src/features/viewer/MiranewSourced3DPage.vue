<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  onMounted,
  ref,
  shallowRef,
  watch,
  type Component,
} from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { chainCinemas } from '../cinemas/chain-directory'
import {
  isReferenceSpecialSeat,
  seatLayoutReferenceById,
  seatLayoutReferencesForCinema,
  type OfficialSeatLayoutReference,
} from '../cinemas/official-seat-layouts'
import { centreSeatGrid } from '../cinemas/centred-seat-grid'
import { DEFAULT_ESTIMATED_SEAT_POV_HORIZONTAL_FOV } from '../cinemas/seat-screen-assumptions'
import { neighbouringSeat } from '../auditoriums/seat-navigation'
import { DEFAULT_CINEMA_EYE_AIM, cinemaScreenCentreGazeAngles } from './cinema-camera'
import {
  deriveMiranewPreviewGeometry,
  initialMiranewPreviewSeat,
} from './miranew-approximate-scene'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const cinemaSlug = computed(() => String(route.params.slug ?? ''))
const patternId = computed(() => String(route.params.patternId ?? ''))
const cinema = computed(() => chainCinemas.find((item) => item.slug === cinemaSlug.value))
const patterns = computed(() => seatLayoutReferencesForCinema(cinemaSlug.value))
const pattern = computed<OfficialSeatLayoutReference | null>(() => {
  const item = seatLayoutReferenceById(patternId.value)
  return item?.cinemaSlug === cinemaSlug.value ? item : null
})
const geometry = computed(() =>
  pattern.value ? deriveMiranewPreviewGeometry(pattern.value) : null,
)
const immersive = computed(() => route.query.view === '3d')
const selectedSeatId = ref('')
const viewMode = ref<'seat' | 'overview'>('seat')
const eyeAim = ref<'eye-level' | 'screen-centre'>(DEFAULT_CINEMA_EYE_AIM)
const resetViewToken = ref(0)
const webglAvailable = ref(true)
const sceneError = ref(false)
const sceneComponent = shallowRef<Component | null>(null)
const CinemaSensoryPilot = defineAsyncComponent(() => import('./CinemaSensoryPilot.vue'))
const pilotVideo = shallowRef<HTMLVideoElement | null>(null)

const selected = computed(
  () => geometry.value?.seats.find((seat) => seat.id === selectedSeatId.value) ?? null,
)
const previous = computed(() =>
  geometry.value && selected.value
    ? neighbouringSeat(geometry.value.seats, selectedSeatId.value, -1)
    : null,
)
const next = computed(() =>
  geometry.value && selected.value
    ? neighbouringSeat(geometry.value.seats, selectedSeatId.value, 1)
    : null,
)
const screenGaze = computed(() =>
  selected.value && geometry.value
    ? cinemaScreenCentreGazeAngles(selected.value, geometry.value.auditorium.screen)
    : null,
)

function labelFor(item: OfficialSeatLayoutReference): string {
  const category =
    item.category === 'imax'
      ? 'IMAX'
      : item.category === 'royal'
        ? t('seatRefs.royal')
        : t('seatRefs.standard')
  return (
    category +
    ' · ' +
    t('seatRefs.labels', { count: item.totalSeatLabels }) +
    ' · ' +
    item.id.slice(-6)
  )
}
const backToSources = computed(() => ({
  path: '/cinemas/' + cinemaSlug.value,
  query: { miranewPattern: patternId.value },
  hash: '#miranew-seat-references',
}))

/** One transform for sourced grid, 2D screen line, 3D bank and accessible markers. */
const grid = computed(() => {
  const current = pattern.value
  if (!current) return null
  const ordinary = current.seatPositions.filter(([id]) => !isReferenceSpecialSeat(id))
  const wheelchairPositions = current.seatPositions
    .filter(([id]) => isReferenceSpecialSeat(id))
    .map(([, row, col]) => [row, col] as const)
  const gridRows = Math.max(...current.seatPositions.map(([, row]) => row))
  const ratio = geometry.value
    ? geometry.value.auditorium.screen.width / geometry.value.calibration.estimatedSeatBlockWidthM
    : 0.86
  return centreSeatGrid(
    { seatPositions: ordinary, wheelchairPositions, gridRows },
    31,
    31,
    560,
    ratio,
  )
})

function selectSeat(id: string) {
  if (!geometry.value?.seats.some((seat) => seat.id === id)) return
  selectedSeatId.value = id
  eyeAim.value = DEFAULT_CINEMA_EYE_AIM
  void router.replace({ query: { ...route.query, seat: id } })
}
function switchSeat(direction: -1 | 1) {
  const item = direction === -1 ? previous.value : next.value
  if (item) selectSeat(item.id)
}
function switchPattern(id: string) {
  if (!patterns.value.some((item) => item.id === id)) return
  void router.push({
    name: 'miranew-sourced-3d-pattern',
    params: { slug: cinemaSlug.value, patternId: id },
  })
}
function setImmersive(value: boolean) {
  if (value) eyeAim.value = DEFAULT_CINEMA_EYE_AIM
  void router.replace({
    query: { ...route.query, view: value ? '3d' : undefined, seat: selectedSeatId.value },
  })
}
function resetView() {
  eyeAim.value = DEFAULT_CINEMA_EYE_AIM
  resetViewToken.value++
}
function toggleViewMode() {
  viewMode.value = viewMode.value === 'seat' ? 'overview' : 'seat'
}
function toggleEyeAim() {
  eyeAim.value = eyeAim.value === 'eye-level' ? 'screen-centre' : 'eye-level'
}
function onPilotVideoElement(video: HTMLVideoElement | null) {
  pilotVideo.value = video
}
function assignScene(component: Component) {
  sceneComponent.value = component
}
async function loadScene() {
  if (sceneComponent.value || sceneError.value || !webglAvailable.value) return
  try {
    assignScene((await import('./ThreeCinemaScene.vue')).default)
  } catch {
    sceneError.value = true
  }
}
watch(
  [pattern, geometry],
  ([currentPattern, currentGeometry]) => {
    if (!currentPattern || !currentGeometry) {
      selectedSeatId.value = ''
      return
    }
    const possible = route.query.seat
    selectedSeatId.value =
      typeof possible === 'string' && currentGeometry.seats.some((seat) => seat.id === possible)
        ? possible
        : initialMiranewPreviewSeat(currentGeometry)
    eyeAim.value = DEFAULT_CINEMA_EYE_AIM
    viewMode.value = 'seat'
  },
  { immediate: true },
)
watch(
  () => route.query.seat,
  (id) => {
    if (typeof id === 'string' && geometry.value?.seats.some((seat) => seat.id === id)) {
      selectedSeatId.value = id
      eyeAim.value = DEFAULT_CINEMA_EYE_AIM
    }
  },
)
watch(immersive, (visible) => {
  if (visible) void loadScene()
})
onMounted(() => {
  try {
    webglAvailable.value = Boolean(document.createElement('canvas').getContext('webgl2'))
  } catch {
    webglAvailable.value = false
  }
  if (immersive.value && webglAvailable.value) void loadScene()
})
</script>

<template>
  <main class="container vieshow-3d-page" :class="{ 'viewer-page--immersive': immersive }">
    <div
      v-if="!pattern || !geometry || !cinema || !grid"
      class="vieshow-3d-page__placeholder"
      role="alert"
    >
      {{ t('miranew3d.notFound') }}
      <RouterLink :to="'/cinemas/' + cinemaSlug">{{ t('miranew3d.backToReference') }}</RouterLink>
    </div>
    <template v-else>
      <div v-show="!immersive">
        <RouterLink :to="backToSources" class="back-link">
          <v-icon icon="mdi-chevron-left" size="19" />
          {{ t('miranew3d.backToReference') }}
        </RouterLink>
        <div class="vieshow-3d-page__hall-switch">
          <label for="miranew-pattern-switch">{{ t('miranew3d.switchPattern') }}</label>
          <select
            id="miranew-pattern-switch"
            :value="pattern.id"
            @change="switchPattern(($event.target as HTMLSelectElement).value)"
          >
            <option v-for="item in patterns" :key="item.id" :value="item.id">
              {{ labelFor(item) }}
            </option>
          </select>
        </div>
        <header class="vieshow-3d-page__header">
          <h1>{{ cinema.name }} · {{ labelFor(pattern) }}</h1>
          <p>{{ t('miranew3d.description') }}</p>
        </header>
        <p class="vieshow-3d-page__assumption" role="note">
          {{ t('miranew3d.hallUnconfirmed') }}
        </p>
        <section class="vieshow-3d-page__map-section">
          <div class="vieshow-3d-page__section-heading">
            <h2>{{ t('vieshow3d.pickSeat') }}</h2>
            <span>{{ t('miranew3d.selectableSeats', { count: geometry.seats.length }) }}</span>
          </div>
          <div class="vieshow-3d-page__workbench">
            <div class="vieshow-3d-page__map-area">
              <div class="vieshow-3d-page__map-tools">
                <div class="vieshow-3d-page__orientation">
                  <v-icon icon="mdi-arrow-up" size="16" />
                  {{ t('vieshowSeatRefs.screenDirection') }}
                </div>
              </div>
              <div
                class="seat-references__scroll vieshow-3d-page__map-scroll"
                tabindex="0"
                :aria-label="t('seatRefs.scrollMap')"
              >
                <svg
                  :viewBox="'0 0 ' + grid.width + ' ' + grid.height"
                  :width="grid.width"
                  :height="grid.height"
                  class="seat-references__svg"
                  role="group"
                  :aria-label="t('seatRefs.mapLabel', { count: pattern.totalSeatLabels })"
                >
                  <text
                    :x="grid.width / 2"
                    y="27"
                    text-anchor="middle"
                    class="seat-references__screen-label"
                  >
                    {{ t('vieshowSeatRefs.screenDirection') }}
                  </text>
                  <path
                    :d="'M ' + grid.screenStartX + ' 38 L ' + grid.screenEndX + ' 38'"
                    class="seat-references__screen"
                  />
                  <g
                    v-for="[id, row, column] in pattern.seatPositions"
                    :key="id"
                    :role="isReferenceSpecialSeat(id) ? undefined : 'button'"
                    :tabindex="isReferenceSpecialSeat(id) ? undefined : 0"
                    :aria-label="
                      isReferenceSpecialSeat(id)
                        ? t('seatRefs.wLabel') + ' · ' + id
                        : t('miranew3d.selectSeat', { seat: id })
                    "
                    :aria-pressed="isReferenceSpecialSeat(id) ? undefined : selectedSeatId === id"
                    class="vieshow-3d-page__seat"
                    @click="!isReferenceSpecialSeat(id) && selectSeat(id)"
                    @keydown.enter.prevent="!isReferenceSpecialSeat(id) && selectSeat(id)"
                    @keydown.space.prevent="!isReferenceSpecialSeat(id) && selectSeat(id)"
                  >
                    <title>{{ id }}</title>
                    <rect
                      :x="grid.seatX(column)"
                      :y="65 + (row - 1) * 31"
                      width="26"
                      height="25"
                      rx="5"
                      :class="
                        isReferenceSpecialSeat(id)
                          ? 'seat-references__seat--special'
                          : selectedSeatId === id
                            ? 'vieshow-3d-page__seat--active'
                            : 'seat-references__seat'
                      "
                    />
                    <text
                      :x="grid.labelX(column)"
                      :y="81 + (row - 1) * 31"
                      text-anchor="middle"
                      class="seat-references__seat-label"
                      :class="{
                        'vieshow-3d-page__seat-label--active':
                          selectedSeatId === id && !isReferenceSpecialSeat(id),
                      }"
                    >
                      {{ id }}
                    </text>
                  </g>
                </svg>
              </div>
              <div class="vieshow-3d-page__map-status" aria-live="polite">
                <span class="vieshow-3d-page__selected-dot" aria-hidden="true" />
                <span>{{ t('vieshow3d.selectedSeat') }}</span>
                <strong>{{ selectedSeatId }}</strong>
              </div>
            </div>
            <div class="vieshow-3d-page__selection">
              <label>
                {{ t('vieshow3d.selectedSeat') }}
                <select
                  :value="selectedSeatId"
                  @change="selectSeat(($event.target as HTMLSelectElement).value)"
                >
                  <option v-for="seat in geometry.seats" :key="seat.id" :value="seat.id">
                    {{ seat.id }}
                  </option>
                </select>
              </label>
              <button class="button-primary" type="button" @click="setImmersive(true)">
                <v-icon icon="mdi-cube-scan" size="19" />
                {{ t('vieshow3d.preview3d') }}
              </button>
            </div>
          </div>
        </section>
        <p class="vieshow-3d-page__assumption" role="note">
          {{ t('miranew3d.proportionalWarning') }}
          <a :href="pattern.snapshotSource" target="_blank" rel="noopener noreferrer">
            {{ t('seatRefs.openOfficial') }}
          </a>
        </p>
      </div>

      <div v-if="immersive" class="viewer-immersive">
        <div v-if="!webglAvailable" class="viewer-immersive__fallback" role="status">
          {{ t('vieshow3d.webglUnavailable') }}
        </div>
        <div v-else-if="sceneError" class="viewer-immersive__fallback" role="alert">
          {{ t('vieshow3d.sceneFailed') }}
        </div>
        <div v-else-if="!sceneComponent" class="viewer-immersive__fallback" role="status">
          {{ t('vieshow3d.loadingScene') }}
        </div>
        <component
          :is="sceneComponent"
          v-else
          :key="pattern.id"
          :auditorium="geometry.auditorium"
          :seats="geometry.seats"
          :wheelchair-spots="geometry.wheelchairSpots"
          :selected-seat-id="selectedSeatId"
          :reset-view-token="resetViewToken"
          :horizontal-fov="DEFAULT_ESTIMATED_SEAT_POV_HORIZONTAL_FOV"
          :eye-aim="eyeAim"
          :view-mode="viewMode"
          :demo-video="pilotVideo"
        />
        <div class="viewer-immersive__top">
          <button type="button" class="viewer-glass-button" @click="setImmersive(false)">
            <v-icon icon="mdi-chevron-left" size="20" />{{ t('vieshow3d.backToMap') }}
          </button>
        </div>
        <CinemaSensoryPilot
          v-if="webglAvailable && !sceneError && sceneComponent"
          :key="pattern.id"
          :selected-seat-id="selectedSeatId"
          :seat-count-warning="t('miranew3d.hallUnconfirmed')"
          :can-previous="!!previous"
          :can-next="!!next"
          :view-mode="viewMode"
          :eye-aim="eyeAim"
          :vertical-gaze="screenGaze?.verticalDegrees"
          :horizontal-gaze="screenGaze?.horizontalDegrees"
          :record-seat-enabled="false"
          @video-element="onPilotVideoElement"
          @previous-seat="switchSeat(-1)"
          @next-seat="switchSeat(1)"
          @toggle-view-mode="toggleViewMode"
          @toggle-eye-aim="toggleEyeAim"
          @reset-view="resetView"
        />
      </div>
    </template>
  </main>
</template>
