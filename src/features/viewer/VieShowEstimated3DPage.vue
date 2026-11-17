<script setup lang="ts">
import { computed, nextTick, onMounted, ref, shallowRef, watch, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { chainCinemas } from '../cinemas/chain-directory'
import { centreSeatGrid } from '../cinemas/centred-seat-grid'
import {
  loadVieShowArchiveForCinema,
  type VieShowArchivedLayout,
} from '../cinemas/vieshow-seat-archive'
import { neighbouringSeat } from '../auditoriums/seat-navigation'
import { calculateSightline } from '../auditoriums/geometry'
import { horizontalFovPresets, type HorizontalFovPreset } from './view-projection'
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
const parameters = ref({ ...defaultVieShowPreviewParameters })
const horizontalFov = ref<HorizontalFovPreset>(80)
const resetViewToken = ref(0)
const immersiveViewMode = ref<'seat' | 'overview'>('seat')
const webglAvailable = ref(true)
const sceneError = ref(false)
const sceneComponent = shallowRef<Component | null>(null)

const slug = computed(() => String(route.params.slug))
const hallId = computed(() => String(route.params.hallId))
const venue = computed(() => chainCinemas.find((item) => item.slug === slug.value))
const immersive = computed(() => route.query.view === '3d')
const cinemaHallListRoute = computed(() => ({
  path: '/cinemas/' + slug.value,
  query: layout.value ? { hall: String(layout.value.hallNumber ?? layout.value.hallLabel) } : {},
  hash: '#vieshow-seat-references',
}))
const geometry = computed(() =>
  layout.value ? deriveVieShowPreviewGeometry(slug.value, layout.value, parameters.value) : null,
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
const sightline = computed(() =>
  selected.value && geometry.value
    ? calculateSightline(selected.value, geometry.value.auditorium.screen)
    : null,
)
const cellWidth = 31
const cellHeight = 31
const map = computed(() =>
  layout.value ? centreSeatGrid(layout.value, cellWidth, cellHeight, 540) : null,
)
const mapWidth = computed(() => map.value?.width ?? 540)
const mapHeight = computed(() => map.value?.height ?? 210)
watch(
  [hallId, mapWidth],
  async () => {
    await nextTick()
    const scroll = mapScroll.value
    if (scroll) scroll.scrollLeft = Math.max(0, (scroll.scrollWidth - scroll.clientWidth) / 2)
  },
  { flush: 'post' },
)
const countWarning = computed(() => {
  const item = layout.value
  if (!item) return ''
  if (item.countComparison === 'different')
    return t('vieshowSeatRefs.countDifference', {
      observed: item.ordinarySeatCount,
      published: item.publishedSeatCount,
    })
  if (item.countComparison === 'not-published') return t('vieshowSeatRefs.notPublished')
  return t('vieshowSeatRefs.exactCount')
})
const screenSource = computed(() => geometry.value?.screenSpecification)
const dataDescription = computed(() => {
  const value = screenSource.value
  if (!value) return t('vieshow3d.screenEstimated')
  return value.dimensionSource === 'operator-published'
    ? t('vieshow3d.screenOfficial')
    : t('vieshow3d.screenSecondary')
})
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
    loading.value = true
    failed.value = false
    layout.value = null
    venueLayouts.value = []
    seatId.value = ''
    parameters.value = { ...defaultVieShowPreviewParameters }
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
  try {
    const canvas = document.createElement('canvas')
    webglAvailable.value = Boolean(canvas.getContext('webgl2'))
  } catch {
    webglAvailable.value = false
  }
  if (immersive.value && webglAvailable.value) void loadScene()
})

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
function resetParameters() {
  parameters.value = { ...defaultVieShowPreviewParameters }
  resetViewToken.value++
}
function toggleImmersiveViewMode() {
  immersiveViewMode.value = immersiveViewMode.value === 'seat' ? 'overview' : 'seat'
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
              {{
                t('vieshowSeatRefs.hallOption', {
                  hall: item.hallLabel,
                  count: item.ordinarySeatCount,
                })
              }}
            </option>
          </select>
          <RouterLink :to="cinemaHallListRoute">{{ t('vieshow3d.allHallsLink') }}</RouterLink>
        </div>
        <header class="vieshow-3d-page__header">
          <span class="eyebrow">THEATGOOD / 3D SEATING REFERENCE</span>
          <h1>{{ venue.name }} · {{ layout.hallLabel }}</h1>
          <p>{{ t('vieshow3d.description') }}</p>
          <p class="vieshow-3d-page__notice" role="note">
            {{ countWarning }} {{ t('vieshow3d.simulationWarning') }}
          </p>
        </header>

        <div class="vieshow-3d-page__facts">
          <span>{{ t('vieshow3d.numberedSeats', { count: layout.ordinarySeatCount }) }}</span>
          <span>{{
            t('vieshowSeatRefs.wheelchairMarkers', { count: layout.wheelchairMarkers })
          }}</span>
          <span>{{ t('vieshowSeatRefs.checkedAt', { date: layout.observedAt }) }}</span>
        </div>

        <section class="vieshow-3d-page__map-section">
          <div class="vieshow-3d-page__section-heading">
            <h2>{{ t('vieshow3d.pickSeat') }}</h2>
            <span>{{ t('vieshow3d.tapSeats') }}</span>
          </div>
          <div
            ref="mapScroll"
            class="seat-references__scroll vieshow-3d-page__map-scroll"
            tabindex="0"
            :aria-label="t('vieshowSeatRefs.scrollMap')"
          >
            <svg
              :viewBox="'0 0 ' + mapWidth + ' ' + mapHeight"
              :width="mapWidth"
              :height="mapHeight"
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
                    seatId === seat[0] ? 'vieshow-3d-page__seat--active' : 'seat-references__seat'
                  "
                />
                <text
                  :x="map?.labelX(seat[2])"
                  :y="81 + (seat[1] - 1) * cellHeight"
                  text-anchor="middle"
                  class="seat-references__seat-label"
                >
                  {{ seat[0] }}
                </text>
              </g>
              <g v-for="(position, index) in layout.wheelchairPositions" :key="'wheel-' + index">
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

          <div class="vieshow-3d-page__selection">
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
        </section>

        <section class="vieshow-3d-page__parameters">
          <div class="vieshow-3d-page__section-heading">
            <h2>{{ t('vieshow3d.specifications') }}</h2>
            <span>{{ dataDescription }}</span>
          </div>
          <div class="vieshow-3d-page__screen-stats">
            <div>
              <span>{{ t('vieshow3d.screenSize') }}</span>
              <strong
                >{{ geometry.auditorium.screen.width.toFixed(2) }} ×
                {{ geometry.auditorium.screen.height.toFixed(2) }} m</strong
              >
              <small>{{ dataDescription }}</small>
            </div>
            <div>
              <span>{{ t('vieshow3d.firstRow') }}</span>
              <strong>{{ parameters.frontDistanceM.toFixed(1) }} m</strong>
              <small>{{ t('vieshow3d.visualEstimate') }}</small>
            </div>
            <div>
              <span>{{ t('vieshow3d.rowPitch') }}</span>
              <strong>{{ parameters.rowSpacingM.toFixed(2) }} m</strong>
              <small>{{ t('vieshow3d.visualEstimate') }}</small>
            </div>
            <div>
              <span>{{ t('vieshow3d.rise') }}</span>
              <strong>{{ parameters.rowRiseM.toFixed(2) }} m</strong>
              <small>{{ t('vieshow3d.visualEstimate') }}</small>
            </div>
          </div>
          <div class="vieshow-3d-page__calibration" role="note">
            <strong>{{ t('vieshow3d.proportionTitle') }}</strong>
            <p v-if="screenSource">
              {{
                t('vieshow3d.knownScreenProportion', {
                  width: screenSource.screenWidthM.toFixed(2),
                  cells: geometry.calibration.occupiedColumns,
                  ratio: Math.round(parameters.screenToSeatBlockWidthRatio * 100),
                })
              }}
            </p>
            <p v-else>{{ t('vieshow3d.unknownScreenProportion') }}</p>
            <p>
              {{
                t('vieshow3d.derivedGridDimensions', {
                  pitch: geometry.calibration.calculatedGridPitchM.toFixed(2),
                  blockWidth: geometry.calibration.estimatedSeatBlockWidthM.toFixed(2),
                })
              }}
            </p>
            <small>{{ t('vieshow3d.ratioScaleWarning') }}</small>
          </div>
          <div v-if="screenSource" class="vieshow-3d-page__source">
            <strong>{{ screenSource.format }} · {{ screenSource.projection }}</strong>
            <p>{{ t('vieshow3d.capacityCrossReference') }}</p>
            <a :href="screenSource.dimensionSourceUrl" target="_blank" rel="noopener noreferrer">
              {{ t('vieshow3d.dimensionSource') }}
              <v-icon icon="mdi-open-in-new" size="14" />
            </a>
            <a
              :href="screenSource.hallIdentificationSourceUrl"
              target="_blank"
              rel="noopener noreferrer"
            >
              {{ t('vieshow3d.hallSource') }}
              <v-icon icon="mdi-open-in-new" size="14" />
            </a>
          </div>
          <p class="vieshow-3d-page__subtle">{{ t('vieshow3d.parametersExplanation') }}</p>
          <div class="vieshow-3d-page__sliders">
            <label v-if="screenSource">
              <span>
                {{ t('vieshow3d.screenSeatBlockRatio') }} ·
                {{ Math.round(parameters.screenToSeatBlockWidthRatio * 100) }}%
              </span>
              <input
                v-model.number="parameters.screenToSeatBlockWidthRatio"
                type="range"
                min="0.55"
                max="1.35"
                step="0.01"
              />
            </label>
            <label v-else>
              <span
                >{{ t('vieshow3d.seatSpacing') }} · {{ parameters.seatSpacingM.toFixed(2) }} m</span
              >
              <input
                v-model.number="parameters.seatSpacingM"
                type="range"
                min="0.48"
                max="0.95"
                step="0.01"
              />
            </label>
            <label>
              <span>{{ t('vieshow3d.rowPitch') }} · {{ parameters.rowSpacingM.toFixed(2) }} m</span>
              <input
                v-model.number="parameters.rowSpacingM"
                type="range"
                min="0.75"
                max="1.8"
                step="0.01"
              />
            </label>
            <label>
              <span>{{ t('vieshow3d.rise') }} · {{ parameters.rowRiseM.toFixed(2) }} m</span>
              <input
                v-model.number="parameters.rowRiseM"
                type="range"
                min="0.05"
                max="0.4"
                step="0.01"
              />
            </label>
            <label>
              <span
                >{{ t('vieshow3d.firstRow') }} · {{ parameters.frontDistanceM.toFixed(1) }} m</span
              >
              <input
                v-model.number="parameters.frontDistanceM"
                type="range"
                min="2.5"
                max="12"
                step="0.5"
              />
            </label>
            <label v-if="!screenSource">
              <span
                >{{ t('vieshow3d.screenScale') }} ·
                {{ Math.round(parameters.estimatedScreenScale * 100) }}%</span
              >
              <input
                v-model.number="parameters.estimatedScreenScale"
                type="range"
                min="0.65"
                max="1.5"
                step="0.05"
              />
            </label>
          </div>
          <button class="vieshow-3d-page__reset" type="button" @click="resetParameters">
            {{ t('vieshow3d.restoreEstimates') }}
          </button>
          <p class="vieshow-3d-page__source">
            {{ t('vieshow3d.layoutSource') }}
            <a :href="layout.snapshotSource" target="_blank" rel="noopener noreferrer">{{
              t('vieshowSeatRefs.openOfficial')
            }}</a>
          </p>
          <p class="vieshow-3d-page__subtle">{{ t('vieshow3d.simulationWarning') }}</p>
        </section>
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
          :horizontal-fov="horizontalFov"
          :view-mode="immersiveViewMode"
        />
        <div class="viewer-immersive__top">
          <button type="button" class="viewer-glass-button" @click="setImmersive(false)">
            <v-icon icon="mdi-chevron-left" size="20" />{{ t('vieshow3d.backToMap') }}
          </button>
          <span class="viewer-glass-button viewer-immersive__seat"
            >{{ layout.hallLabel }} · {{ seatId }}</span
          >
        </div>
        <div class="viewer-immersive__bottom">
          <p class="viewer-immersive__hint">
            {{
              immersiveViewMode === 'overview'
                ? t('vieshow3d.overviewHint')
                : t('vieshow3d.immersiveCaveat')
            }}
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
            <details class="viewer-details">
              <summary>
                {{ t('viewer.details') }} <v-icon icon="mdi-chevron-down" size="16" />
              </summary>
              <label class="viewer-fov-control">
                {{ t('viewer.projectionFov') }}
                <select v-model.number="horizontalFov">
                  <option v-for="angle in horizontalFovPresets" :key="angle" :value="angle">
                    {{ angle }}°
                  </option>
                </select>
              </label>
              <dl v-if="sightline">
                <div>
                  <dt>{{ t('viewer.distance') }}</dt>
                  <dd>{{ sightline.distance.toFixed(1) }} m</dd>
                </div>
                <div>
                  <dt>{{ t('viewer.horizontal') }}</dt>
                  <dd>{{ sightline.horizontalAngle.toFixed(1) }}°</dd>
                </div>
                <div>
                  <dt>{{ t('viewer.vertical') }}</dt>
                  <dd>{{ sightline.verticalAngle.toFixed(1) }}°</dd>
                </div>
              </dl>
              <p>{{ t('vieshow3d.immersiveCaveat') }}</p>
            </details>
          </div>
        </div>
      </div>
    </template>
  </main>
</template>
