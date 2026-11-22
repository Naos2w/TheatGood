<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import SeatMap from '../../components/SeatMap.vue'
import { appLocale } from '../../composables/usePreferences'
import { findAuditorium } from '../auditoriums/catalog'
import { cinemaDirectory, directoryHallName, directoryCinemaName } from '../auditoriums/directory'
import { createSeats } from '../auditoriums/geometry'
import { neighbouringRowSeat, neighbouringSeat } from '../auditoriums/seat-navigation'
import { DEFAULT_ESTIMATED_SEAT_POV_HORIZONTAL_FOV } from '../cinemas/seat-screen-assumptions'
import Cinema3DSeatTools from './Cinema3DSeatTools.vue'
import { swapObservedSeatComparison } from './seat-comparison'
import { useViewerStore } from '../../stores/viewer'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const store = useViewerStore()

const auditorium = computed(() => findAuditorium(String(route.params.auditoriumId)))
const seats = computed(() => (auditorium.value ? createSeats(auditorium.value) : []))
const selectedSeat = computed(
  () => seats.value.find((seat) => seat.id === store.selectedSeatId) ?? seats.value[0],
)
const isFestivalReference = computed(() => auditorium.value?.id === 'vieshow-hsinyi-12')
const sourceHall = computed(() =>
  cinemaDirectory.find((item) => item.modelId === auditorium.value?.id),
)
const isImmersive = computed(() => route.query.view === '3d')
const previousSeat = computed(() => neighbouringSeat(seats.value, store.selectedSeatId, -1))
const nextSeat = computed(() => neighbouringSeat(seats.value, store.selectedSeatId, 1))
const frontRow = computed(() => neighbouringRowSeat(seats.value, store.selectedSeatId, -1))
const backRow = computed(() => neighbouringRowSeat(seats.value, store.selectedSeatId, 1))
const savedComparisonSeatId = ref('')
const horizontalFov = ref(DEFAULT_ESTIMATED_SEAT_POV_HORIZONTAL_FOV)
const viewMode = ref<'seat' | 'overview'>('seat')
const english = computed(() => appLocale.value.startsWith('en'))
const webglAvailable = ref(true)
const sceneError = ref(false)
const sceneComponent = shallowRef<Component | null>(null)
const resetViewToken = ref(0)

function seatName() {
  return sourceHall.value
    ? directoryHallName(sourceHall.value, appLocale.value)
    : t('hall.demoName')
}
function venueName() {
  return sourceHall.value
    ? directoryCinemaName(sourceHall.value, appLocale.value)
    : t('hall.demoVenue')
}

watch(
  () => route.params.auditoriumId,
  (id, previousId) => {
    if (id !== previousId) {
      savedComparisonSeatId.value = ''
      viewMode.value = 'seat'
    }
    const next = findAuditorium(String(id))
    if (!next) {
      void router.replace('/')
      return
    }
    if (id !== previousId || !createSeats(next).some((seat) => seat.id === store.selectedSeatId)) {
      const nextSeats = createSeats(next)
      store.selectSeat(nextSeats.find((seat) => seat.id === 'E07')?.id ?? nextSeats[0]!.id)
    }
  },
  { immediate: true },
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

watch(
  () => route.query.seat,
  (seatId) => {
    const model = auditorium.value
    if (
      model &&
      typeof seatId === 'string' &&
      createSeats(model).some((seat) => seat.id === seatId)
    ) {
      store.selectSeat(seatId)
    }
  },
  { immediate: true },
)

watch(isImmersive, (immersive) => {
  if (immersive) void loadScene()
})

onMounted(() => {
  try {
    const canvas = document.createElement('canvas')
    webglAvailable.value = Boolean(canvas.getContext('webgl2'))
  } catch {
    webglAvailable.value = false
  }
  if (isImmersive.value && webglAvailable.value) void loadScene()
})

function selectSeat(id: string) {
  if (!seats.value.some((seat) => seat.id === id)) return
  store.selectSeat(id)
  void router.replace({ query: { ...route.query, seat: id } })
}

function preview3d() {
  if (!selectedSeat.value) return
  void router.push({ query: { ...route.query, view: '3d' } })
}

function recordSelectedSeat() {
  if (!sourceHall.value?.modelId || !selectedSeat.value) return
  void router.push({
    path: '/history',
    query: { auditorium: sourceHall.value.modelId, seat: selectedSeat.value.id },
  })
}

function returnToSeats() {
  void router.replace({ query: { ...route.query, view: undefined } })
}

function navigate(direction: -1 | 1) {
  const next = direction === -1 ? previousSeat.value : nextSeat.value
  if (next) selectSeat(next.id)
}
function navigateRow(direction: -1 | 1) {
  const next = direction === -1 ? frontRow.value : backRow.value
  if (next) selectSeat(next.id)
}
function swapComparison() {
  const swap = swapObservedSeatComparison(
    seats.value,
    store.selectedSeatId,
    savedComparisonSeatId.value,
  )
  if (!swap) return
  savedComparisonSeatId.value = swap.nextSaved
  selectSeat(swap.nextSelected)
}
</script>

<template>
  <div
    v-if="auditorium && selectedSeat"
    class="viewer-page"
    :class="{ 'viewer-page--immersive': isImmersive }"
  >
    <div v-show="!isImmersive" class="viewer-map-wrapper">
      <section class="container viewer-map-page">
        <div class="viewer-map-page__top">
          <RouterLink
            :to="
              isFestivalReference
                ? '/cinemas/vieshow-taipei-hsinyi?hall=12#vieshow-seat-references'
                : '/'
            "
            class="back-link"
          >
            <v-icon icon="mdi-chevron-left" size="25" />
            {{ t('app.back') }}
          </RouterLink>
        </div>

        <div class="viewer-map-page__heading">
          <h1>{{ isFestivalReference ? t('viewer.festivalHistoricalTitle') : seatName() }}</h1>
          <p>{{ venueName() }}</p>
        </div>

        <nav
          v-if="isFestivalReference"
          class="viewer-festival-upgrade"
          aria-label="viewer-festival-upgrade"
        >
          <div>
            <strong>{{ t('viewer.festivalArchiveTitle') }}</strong>
            <p>{{ t('viewer.festivalArchiveDescription') }}</p>
          </div>
          <div class="viewer-festival-upgrade__actions">
            <RouterLink
              class="viewer-festival-upgrade__primary"
              to="/cinemas/vieshow-taipei-hsinyi/halls/vieshow-taipei-hsinyi-12"
            >
              <v-icon icon="mdi-seat-outline" size="18" /> {{ t('viewer.festivalOpenCurrent') }}
            </RouterLink>
            <RouterLink to="/cinemas/vieshow-taipei-hsinyi?hall=12#vieshow-seat-references">
              {{ t('viewer.festivalBrowseHalls') }} <v-icon icon="mdi-arrow-right" size="17" />
            </RouterLink>
          </div>
        </nav>

        <section class="seat-map-panel">
          <SeatMap
            :key="auditorium.id"
            :auditorium="auditorium"
            :seats="seats"
            :selected-seat-id="store.selectedSeatId"
            @select-seat="selectSeat"
          />
        </section>
      </section>

      <div class="viewer-seat-action glass-panel">
        <div>
          <span>{{ t('seats.selected') }}</span>
          <strong>{{ selectedSeat.id }}</strong>
        </div>
        <div class="viewer-seat-action__buttons">
          <button
            v-if="sourceHall?.modelId"
            class="viewer-record-button"
            type="button"
            @click="recordSelectedSeat"
          >
            <v-icon icon="mdi-bookmark-plus-outline" size="18" />
            {{ t('history.recordSeat') }}
          </button>
          <button class="button-primary" type="button" @click="preview3d">
            <v-icon icon="mdi-eye-outline" size="20" />
            {{ t('seats.preview') }}
            <v-icon icon="mdi-arrow-top-right" size="18" />
          </button>
        </div>
      </div>
    </div>

    <div v-if="isImmersive" class="viewer-immersive">
      <div v-if="!webglAvailable" class="viewer-immersive__fallback" role="status">
        <v-icon icon="mdi-cube-off-outline" size="48" />
        {{ t('viewer.unavailable') }}
      </div>
      <div v-else-if="sceneError" class="viewer-immersive__fallback" role="alert">
        <v-icon icon="mdi-alert-circle-outline" size="48" />
        {{ t('viewer.error') }}
      </div>
      <div v-else-if="!sceneComponent" class="viewer-immersive__fallback" role="status">
        <v-progress-circular indeterminate color="primary" :size="40" />
        {{ t('viewer.loading') }}
      </div>
      <component
        :is="sceneComponent"
        v-else
        :key="auditorium.id"
        :auditorium="auditorium"
        :seats="seats"
        :selected-seat-id="store.selectedSeatId"
        :reset-view-token="resetViewToken"
        :horizontal-fov="horizontalFov"
        :view-mode="viewMode"
      />

      <div class="viewer-immersive__top">
        <button
          type="button"
          class="viewer-glass-button viewer-immersive__back"
          @click="returnToSeats"
        >
          <v-icon icon="mdi-chevron-left" size="24" />
          <span>{{ t('viewer.backToSeats') }}</span>
        </button>
        <span class="viewer-glass-button viewer-immersive__seat">{{ selectedSeat.id }}</span>
      </div>

      <div class="viewer-immersive__bottom">
        <Cinema3DSeatTools
          :horizontal-fov="horizontalFov"
          :can-move-front="!!frontRow"
          :can-move-back="!!backRow"
          :english="english"
          :selected-seat-id="store.selectedSeatId"
          :saved-comparison-seat-id="savedComparisonSeatId"
          @update:horizontal-fov="horizontalFov = $event"
          @move-row="navigateRow"
          @save-comparison="savedComparisonSeatId = store.selectedSeatId"
          @swap-comparison="swapComparison"
          @clear-comparison="savedComparisonSeatId = ''"
        />
        <p class="viewer-immersive__hint">{{ t('ux.dragHint') }}</p>
        <div class="viewer-switcher glass-panel">
          <button
            type="button"
            :aria-label="t('viewer.previous')"
            :disabled="!previousSeat"
            @click="navigate(-1)"
          >
            <v-icon icon="mdi-chevron-left" size="31" />
          </button>
          <div class="viewer-switcher__seat" aria-live="polite">
            <strong>{{ selectedSeat.id }}</strong>
            <span>{{ t('viewer.selectedSeat') }}</span>
          </div>
          <button
            type="button"
            :aria-label="t('viewer.next')"
            :disabled="!nextSeat"
            @click="navigate(1)"
          >
            <v-icon icon="mdi-chevron-right" size="31" />
          </button>
        </div>
        <div class="viewer-immersive__utility">
          <button
            type="button"
            class="viewer-reset"
            @click="viewMode = viewMode === 'seat' ? 'overview' : 'seat'"
          >
            <v-icon
              :icon="viewMode === 'seat' ? 'mdi-view-dashboard-outline' : 'mdi-seat-recline-normal'"
              size="19"
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
          <button type="button" class="viewer-reset" @click="resetViewToken++">
            <v-icon icon="mdi-restore" size="19" />
            {{ t('viewer.reset') }}
          </button>
          <button
            v-if="sourceHall?.modelId"
            type="button"
            class="viewer-reset viewer-immersive__record"
            @click="recordSelectedSeat"
          >
            <v-icon icon="mdi-bookmark-plus-outline" size="18" />
            {{ t('history.recordSeat') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
