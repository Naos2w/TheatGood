<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  shallowRef,
  watch,
  type Component,
} from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { chainCinemas } from '../cinemas/chain-directory'
import { centreSeatGrid } from '../cinemas/centred-seat-grid'
import { DEFAULT_ESTIMATED_SEAT_POV_HORIZONTAL_FOV } from '../cinemas/seat-screen-assumptions'
import {
  loadVieShowArchiveForCinema,
  type VieShowArchivedLayout,
} from '../cinemas/vieshow-seat-archive'
import { neighbouringSeat } from '../auditoriums/seat-navigation'
import {
  defaultVieShowPreviewParameters,
  deriveVieShowPreviewGeometry,
  initialVieShowPreviewSeat,
} from './vieshow-approximate-scene'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const layout = shallowRef<VieShowArchivedLayout | null>(null)
const mapScroll = ref<HTMLElement | null>(null)
const venueLayouts = shallowRef<readonly VieShowArchivedLayout[]>([])
const loading = ref(false)
const failed = ref(false)
const seatId = ref('')
const mapZoom = ref(1)
const resetViewToken = ref(0)
const immersiveViewMode = ref<'seat' | 'overview'>('seat')
const eyeAim = ref<'eye-level' | 'screen-centre'>('eye-level')
const webglAvailable = ref(true)
const sceneError = ref(false)
const sceneComponent = shallowRef<Component | null>(null)
const CinemaSensoryPilot = defineAsyncComponent(() => import('./CinemaSensoryPilot.vue'))
const pilotVideo = shallowRef<HTMLVideoElement | null>(null)

const slug = computed(() => String(route.params.slug))
const hallId = computed(() => String(route.params.hallId))
const venue = computed(() => chainCinemas.find((item) => item.slug === slug.value))
const immersive = computed(() => route.query.view === '3d')
// The archive loader validates each hall's source, unique seats and provenance.
// Capacity discrepancies do not invalidate the sourced seat diagram: disclose
// them rather than falsely claiming the 3D preview is a measured floor plan.
const pilotEnabled = computed(() => layout.value?.id === hallId.value)
const seatCountWarning = computed(() => {
  const hall = layout.value
  if (!hall) return ''
  if (hall.countComparison === 'different' && hall.publishedSeatCount !== null)
    return t('vieshowSeatRefs.countDifference', {
      observed: hall.ordinarySeatCount,
      published: hall.publishedSeatCount,
    })
  if (hall.countComparison === 'not-published') return t('vieshowSeatRefs.notPublished')
  if (hall.countComparison === 'wheelchair-markers-match')
    return t('vieshowSeatRefs.wheelchairCountMatch')
  return ''
})
const cinemaHallListRoute = computed(() => ({
  path: '/cinemas/' + slug.value,
  query: layout.value ? { hall: String(layout.value.hallNumber ?? layout.value.hallLabel) } : {},
  hash: '#vieshow-seat-references',
}))
const geometry = computed(() =>
  layout.value
    ? deriveVieShowPreviewGeometry(slug.value, layout.value, defaultVieShowPreviewParameters)
    : null,
)
const selected = computed(
  () => geometry.value?.seats.find((seat) => seat.id === seatId.value) ?? null,
)
const previous = computed(() =>
  geometry.value && selected.value
    ? neighbouringSeat(geometry.value.seats, seatId.value, -1)
    : null,
)
const next = computed(() =>
  geometry.value && selected.value ? neighbouringSeat(geometry.value.seats, seatId.value, 1) : null,
)
const cellWidth = 31
const cellHeight = 31
const map = computed(() => {
  if (!layout.value || !geometry.value) return null
  const seatingBlockWidth = geometry.value.calibration.estimatedSeatBlockWidthM
  const proportionalScreenWidth = geometry.value.auditorium.screen.width
  // The 2D silver-screen line uses the SAME effective estimate as the 3D model,
  // including intentionally bounded screens in very small/large unsurveyed halls.
  return centreSeatGrid(
    layout.value,
    cellWidth,
    cellHeight,
    540,
    proportionalScreenWidth / seatingBlockWidth,
  )
})
const mapWidth = computed(() => map.value?.width ?? 540)
const mapHeight = computed(() => map.value?.height ?? 210)
const displayMapWidth = computed(() => Math.round(mapWidth.value * mapZoom.value))
const displayMapHeight = computed(() => Math.round(mapHeight.value * mapZoom.value))
// Centre the selected seat inside the map viewport, not the entire page.
// A tall auditorium must remain legible: the map itself scrolls in both axes.
let initiallyCentredHall = ''
function revealSelectedSeat(force = false) {
  const scroll = mapScroll.value
  if (!scroll || !scroll.clientWidth || !scroll.clientHeight) return
  const seat = scroll.querySelector<SVGGElement>('.vieshow-3d-page__seat[aria-pressed="true"]')
  const seatRect = seat?.querySelector('rect')?.getBoundingClientRect()
  if (!seatRect) return
  const viewport = scroll.getBoundingClientRect()
  const margin = 26
  if (
    !force &&
    seatRect.left >= viewport.left + margin &&
    seatRect.right <= viewport.right - margin &&
    seatRect.top >= viewport.top + margin &&
    seatRect.bottom <= viewport.bottom - margin
  ) {
    return
  }
  const targetX =
    scroll.scrollLeft + (seatRect.left + seatRect.right - viewport.left - viewport.right) / 2
  const targetY =
    scroll.scrollTop + (seatRect.top + seatRect.bottom - viewport.top - viewport.bottom) / 2
  scroll.scrollLeft = Math.max(0, Math.min(scroll.scrollWidth - scroll.clientWidth, targetX))
  scroll.scrollTop = Math.max(0, Math.min(scroll.scrollHeight - scroll.clientHeight, targetY))
}
// On short phones the page title may fill most of the first viewport. Bring the
// selected seat above the fixed action bar once, without hijacking later scrolls.
function revealInitialSeatOnShortPhone() {
  if (window.innerWidth >= 600 || window.innerHeight >= 700 || window.scrollY > 2) return
  const selectedRect = mapScroll.value
    ?.querySelector('.vieshow-3d-page__seat[aria-pressed="true"] rect')
    ?.getBoundingClientRect()
  const controls = document.querySelector('.vieshow-3d-page__selection')?.getBoundingClientRect()
  if (!selectedRect || !controls || selectedRect.bottom < controls.top - 18) return
  const desiredTop = Math.max(88, Math.min(window.innerHeight * 0.45, controls.top - 60))
  window.scrollTo({ top: window.scrollY + selectedRect.top - desiredTop, behavior: 'instant' })
}
watch(
  [layout, seatId, immersive, mapZoom],
  async ([currentLayout, selectedId, isImmersive, currentZoom], previous) => {
    if (!currentLayout || !selectedId || isImmersive) return
    await nextTick()
    if (seatId.value !== selectedId || layout.value?.id !== currentLayout.id) return
    const force = initiallyCentredHall !== currentLayout.id || previous?.[3] !== currentZoom
    revealSelectedSeat(force)
    if (force) requestAnimationFrame(revealInitialSeatOnShortPhone)
    if (mapScroll.value) initiallyCentredHall = currentLayout.id
  },
  { flush: 'post' },
)
function changeMapZoom(step: number) {
  mapZoom.value = Math.max(1, Math.min(1.75, Math.round((mapZoom.value + step) * 100) / 100))
}
async function resetMapZoom() {
  mapZoom.value = 1
  await nextTick()
  revealSelectedSeat(true)
}
function onMapViewportResize() {
  if (!immersive.value) requestAnimationFrame(() => revealSelectedSeat())
}
const visualRowLabel = (seat: readonly [string, number, number]) => {
  const letter = /^([A-Z]{1,2})\d+$/i.exec(seat[0])?.[1]
  return letter
    ? t('vieshowSeatRefs.rowLabel', { label: letter })
    : t('vieshowSeatRefs.visualRow', { number: seat[1] })
}

watch(
  [slug, hallId],
  async ([nextSlug, nextHall], _old, onCleanup) => {
    let cancelled = false
    onCleanup(() => {
      cancelled = true
    })
    mapZoom.value = 1
    loading.value = true
    failed.value = false
    layout.value = null
    venueLayouts.value = []
    seatId.value = ''
    try {
      const data = await loadVieShowArchiveForCinema(nextSlug)
      if (cancelled) return
      venueLayouts.value = data
      layout.value = data.find((item) => item.id === nextHall) ?? null
      if (layout.value) {
        const candidate = route.query.seat
        const seatIds = new Set(layout.value.seatPositions.map((item) => item[0]))
        seatId.value =
          typeof candidate === 'string' && seatIds.has(candidate)
            ? candidate
            : initialVieShowPreviewSeat(deriveVieShowPreviewGeometry(nextSlug, layout.value))
      }
    } catch {
      if (!cancelled) failed.value = true
    } finally {
      if (!cancelled) loading.value = false
    }
  },
  { immediate: true },
)

watch(
  () => route.query.seat,
  (querySeat) => {
    if (
      typeof querySeat === 'string' &&
      geometry.value?.seats.some((seat) => seat.id === querySeat)
    )
      seatId.value = querySeat
  },
)

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

watch(immersive, (value) => {
  if (value) void loadScene()
})

onMounted(() => {
  window.addEventListener('resize', onMapViewportResize)
  try {
    const canvas = document.createElement('canvas')
    webglAvailable.value = Boolean(canvas.getContext('webgl2'))
  } catch {
    webglAvailable.value = false
  }
  if (immersive.value && webglAvailable.value) void loadScene()
})
onUnmounted(() => window.removeEventListener('resize', onMapViewportResize))

function switchHall(id: string) {
  if (!venueLayouts.value.some((item) => item.id === id)) return
  void router.push({ path: '/cinemas/' + slug.value + '/halls/' + id })
}

function selectSeat(id: string) {
  if (!geometry.value?.seats.some((seat) => seat.id === id)) return
  seatId.value = id
  void router.replace({ query: { ...route.query, seat: id } })
}
function switchSeat(direction: -1 | 1) {
  const item = direction === -1 ? previous.value : next.value
  if (item) selectSeat(item.id)
}
function setImmersive(value: boolean) {
  void router.replace({
    query: { ...route.query, view: value ? '3d' : undefined, seat: seatId.value },
  })
}
function toggleImmersiveViewMode() {
  immersiveViewMode.value = immersiveViewMode.value === 'seat' ? 'overview' : 'seat'
}
function toggleEyeAim() {
  eyeAim.value = eyeAim.value === 'eye-level' ? 'screen-centre' : 'eye-level'
}
function onPilotVideoElement(video: HTMLVideoElement | null) {
  pilotVideo.value = video
}
function recordSelectedSeat() {
  if (!layout.value || !selected.value) return
  void router.push({
    path: '/history',
    query: {
      vieshowCinema: slug.value,
      vieshowHall: layout.value.id,
      seat: seatId.value,
    },
  })
}
</script>

<template>
  <main class="container vieshow-3d-page" :class="{ 'viewer-page--immersive': immersive }">
    <div v-if="loading" role="status" class="vieshow-3d-page__placeholder">
      <v-progress-circular indeterminate color="primary" size="42" />
      {{ t('vieshow3d.loading') }}
    </div>
    <div
      v-else-if="failed || !layout || !geometry || !venue"
      class="vieshow-3d-page__placeholder"
      role="alert"
    >
      {{ t('vieshow3d.notFound') }}
      <RouterLink :to="'/cinemas/' + slug">{{ t('vieshow3d.backToCinema') }}</RouterLink>
    </div>

    <template v-else>
      <div v-show="!immersive">
        <RouterLink :to="cinemaHallListRoute" class="back-link">
          <v-icon icon="mdi-chevron-left" size="19" /> {{ t('vieshow3d.backToCinema') }}
        </RouterLink>
        <div class="vieshow-3d-page__hall-switch">
          <label for="vieshow-hall-switch">{{ t('vieshow3d.chooseDifferentHall') }}</label>
          <select
            id="vieshow-hall-switch"
            :value="layout.id"
            @change="switchHall(($event.target as HTMLSelectElement).value)"
          >
            <option v-for="item in venueLayouts" :key="item.id" :value="item.id">
              {{ item.hallLabel }}
            </option>
          </select>
        </div>
        <header class="vieshow-3d-page__header">
          <h1>
            {{ venue.name }} <span>· {{ layout.hallLabel }}</span>
          </h1>
          <p>{{ t('ux.chooseSeatHint') }}</p>
          <p v-if="seatCountWarning" role="note">{{ seatCountWarning }}</p>
        </header>

        <section class="vieshow-3d-page__map-section">
          <div class="vieshow-3d-page__section-heading">
            <h2>{{ t('vieshow3d.pickSeat') }}</h2>
            <span>{{ t('vieshow3d.tapSeats') }}</span>
          </div>
          <div class="vieshow-3d-page__workbench">
            <div class="vieshow-3d-page__map-area">
              <div class="vieshow-3d-page__map-tools">
                <div class="vieshow-3d-page__orientation" aria-hidden="true">
                  <v-icon icon="mdi-arrow-up" size="16" />
                  {{ t('vieshowSeatRefs.screenDirection') }}
                </div>
                <div class="vieshow-3d-page__zoom-controls">
                  <button
                    type="button"
                    :disabled="mapZoom <= 1"
                    :aria-label="t('seats.zoomOut')"
                    @click="changeMapZoom(-0.25)"
                  >
                    <v-icon icon="mdi-minus" size="19" />
                  </button>
                  <button type="button" :aria-label="t('seats.resetZoom')" @click="resetMapZoom">
                    {{ Math.round(mapZoom * 100) }}%
                  </button>
                  <button
                    type="button"
                    :disabled="mapZoom >= 1.75"
                    :aria-label="t('seats.zoomIn')"
                    @click="changeMapZoom(0.25)"
                  >
                    <v-icon icon="mdi-plus" size="19" />
                  </button>
                </div>
              </div>
              <div
                ref="mapScroll"
                class="seat-references__scroll vieshow-3d-page__map-scroll"
                tabindex="0"
                :aria-label="t('vieshowSeatRefs.scrollMap')"
              >
                <svg
                  :viewBox="'0 0 ' + mapWidth + ' ' + mapHeight"
                  :width="displayMapWidth"
                  :height="displayMapHeight"
                  class="seat-references__svg"
                  role="group"
                  :aria-label="
                    t('vieshowSeatRefs.mapLabel', {
                      hall: layout.hallLabel,
                      count: layout.ordinarySeatCount,
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
                  <path
                    :d="
                      'M ' +
                      (map?.screenStartX ?? 48) +
                      ' 38 L ' +
                      (map?.screenEndX ?? mapWidth - 48) +
                      ' 38'
                    "
                    class="seat-references__screen"
                  />
                  <g
                    v-for="seat in layout.seatPositions"
                    :key="seat[0]"
                    role="button"
                    tabindex="0"
                    :aria-label="
                      t('vieshow3d.selectSeat', { label: seat[0], row: visualRowLabel(seat) })
                    "
                    :aria-pressed="seatId === seat[0]"
                    class="vieshow-3d-page__seat"
                    @click="selectSeat(seat[0])"
                    @keydown.enter.prevent="selectSeat(seat[0])"
                    @keydown.space.prevent="selectSeat(seat[0])"
                  >
                    <title>{{ seat[0] }}</title>
                    <rect
                      :x="map?.seatX(seat[2])"
                      :y="65 + (seat[1] - 1) * cellHeight"
                      width="26"
                      height="25"
                      rx="5"
                      :class="
                        seatId === seat[0]
                          ? 'vieshow-3d-page__seat--active'
                          : 'seat-references__seat'
                      "
                    />
                    <text
                      :x="map?.labelX(seat[2])"
                      :y="81 + (seat[1] - 1) * cellHeight"
                      text-anchor="middle"
                      class="seat-references__seat-label"
                      :class="{ 'vieshow-3d-page__seat-label--active': seatId === seat[0] }"
                    >
                      {{ seat[0] }}
                    </text>
                  </g>
                  <g
                    v-for="(position, index) in layout.wheelchairPositions"
                    :key="'wheel-' + index"
                  >
                    <title>{{ t('vieshowSeatRefs.wheelchairMarker') }}</title>
                    <rect
                      :x="map?.seatX(position[1])"
                      :y="65 + (position[0] - 1) * cellHeight"
                      width="26"
                      height="25"
                      rx="5"
                      class="seat-references__seat--special"
                    />
                  </g>
                </svg>
              </div>
              <div class="vieshow-3d-page__map-status" aria-live="polite">
                <span class="vieshow-3d-page__selected-dot" aria-hidden="true" />
                <span>{{ t('vieshow3d.selectedSeat') }}</span>
                <strong>{{ seatId }}</strong>
              </div>
            </div>

            <div class="vieshow-3d-page__selection">
              <div class="vieshow-3d-page__selected-summary" aria-live="polite">
                <span>{{ t('vieshow3d.selectedSeat') }}</span>
                <strong>{{ seatId }}</strong>
              </div>
              <label>
                {{ t('vieshow3d.selectedSeat') }}
                <select
                  :value="seatId"
                  @change="selectSeat(($event.target as HTMLSelectElement).value)"
                >
                  <option v-for="seat in layout.seatPositions" :key="seat[0]" :value="seat[0]">
                    {{ seat[0] }}
                  </option>
                </select>
              </label>
              <button type="button" class="button-primary" @click="setImmersive(true)">
                <v-icon icon="mdi-cube-scan" size="19" />
                {{ t('vieshow3d.preview3d') }}
              </button>
            </div>
          </div>
        </section>

        <p class="vieshow-3d-page__assumption" role="note">{{ t('ux.simulationNotice') }}</p>
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
          :key="layout.id"
          :auditorium="geometry.auditorium"
          :seats="geometry.seats"
          :wheelchair-spots="geometry.wheelchairSpots"
          :selected-seat-id="seatId"
          :reset-view-token="resetViewToken"
          :horizontal-fov="DEFAULT_ESTIMATED_SEAT_POV_HORIZONTAL_FOV"
          :eye-aim="eyeAim"
          :view-mode="immersiveViewMode"
          :demo-video="pilotEnabled ? pilotVideo : null"
        />
        <div class="viewer-immersive__top">
          <button type="button" class="viewer-glass-button" @click="setImmersive(false)">
            <v-icon icon="mdi-chevron-left" size="20" />{{ t('vieshow3d.backToMap') }}
          </button>
          <span v-if="!pilotEnabled" class="viewer-glass-button viewer-immersive__seat"
            >{{ layout.hallLabel }} · {{ seatId }}</span
          >
        </div>
        <CinemaSensoryPilot
          v-if="pilotEnabled && webglAvailable && !sceneError && sceneComponent"
          :key="layout.id"
          :selected-seat-id="seatId"
          :seat-count-warning="seatCountWarning"
          :can-previous="!!previous"
          :can-next="!!next"
          :view-mode="immersiveViewMode"
          :eye-aim="eyeAim"
          @toggle-eye-aim="toggleEyeAim"
          @video-element="onPilotVideoElement"
          @previous-seat="switchSeat(-1)"
          @next-seat="switchSeat(1)"
          @toggle-view-mode="toggleImmersiveViewMode"
          @reset-view="resetViewToken++"
          @record-seat="recordSelectedSeat"
        />
        <div v-if="!pilotEnabled" class="viewer-immersive__bottom">
          <p class="viewer-immersive__hint">
            {{ immersiveViewMode === 'overview' ? t('ux.overviewHint') : t('ux.dragHint') }}
          </p>
          <div class="viewer-switcher glass-panel">
            <button
              :disabled="!previous"
              :aria-label="t('viewer.previous')"
              @click="switchSeat(-1)"
            >
              <v-icon icon="mdi-chevron-left" size="30" />
            </button>
            <div class="viewer-switcher__seat" aria-live="polite">
              <strong>{{ seatId }}</strong>
              <span>{{
                immersiveViewMode === 'overview'
                  ? t('vieshow3d.overviewTitle')
                  : t('vieshow3d.estimatedPov')
              }}</span>
            </div>
            <button :disabled="!next" :aria-label="t('viewer.next')" @click="switchSeat(1)">
              <v-icon icon="mdi-chevron-right" size="30" />
            </button>
          </div>
          <div class="viewer-immersive__utility">
            <button type="button" class="viewer-reset" @click="resetViewToken++">
              <v-icon icon="mdi-restore" size="19" /> {{ t('viewer.reset') }}
            </button>
            <button type="button" class="viewer-reset" @click="toggleEyeAim">
              <v-icon icon="mdi-eye-outline" size="19" />
              {{ eyeAim === 'eye-level' ? t('vieshow3d.aimAtScreen') : t('vieshow3d.eyeLevel') }}
            </button>
            <button type="button" class="viewer-reset" @click="toggleImmersiveViewMode">
              <v-icon
                :icon="
                  immersiveViewMode === 'seat'
                    ? 'mdi-view-dashboard-outline'
                    : 'mdi-seat-recline-normal'
                "
                size="19"
              />
              {{
                immersiveViewMode === 'seat'
                  ? t('vieshow3d.overviewButton')
                  : t('vieshow3d.seatViewButton')
              }}
            </button>
          </div>
        </div>
      </div>
    </template>
  </main>
</template>
