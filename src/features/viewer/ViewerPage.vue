<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import SeatMap from '../../components/SeatMap.vue'
import { appLocale } from '../../composables/usePreferences'
import { findAuditorium } from '../auditoriums/catalog'
import { cinemaDirectory, directoryHallName, directoryCinemaName } from '../auditoriums/directory'
import { calculateSightline, createSeats } from '../auditoriums/geometry'
import { neighbouringSeat } from '../auditoriums/seat-navigation'
import { horizontalFovPresets, type HorizontalFovPreset } from './view-projection'
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
const isOfficial = computed(() => auditorium.value?.provenance.seatLabels === 'official')
const isFestivalReference = computed(() => auditorium.value?.id === 'vieshow-hsinyi-12')
const sourceHall = computed(() =>
  cinemaDirectory.find((item) => item.modelId === auditorium.value?.id),
)
const isImmersive = computed(() => route.query.view === '3d')
const previousSeat = computed(() => neighbouringSeat(seats.value, store.selectedSeatId, -1))
const nextSeat = computed(() => neighbouringSeat(seats.value, store.selectedSeatId, 1))
const sightline = computed(() =>
  selectedSeat.value && auditorium.value
    ? calculateSightline(selectedSeat.value, auditorium.value.screen)
    : null,
)
const webglAvailable = ref(true)
const sceneError = ref(false)
const sceneComponent = shallowRef<Component | null>(null)
const resetViewToken = ref(0)
/** User-tunable 3D camera projection: not a measured eye/device calibration. */
const horizontalFov = ref<HorizontalFovPreset>(80)

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
  if (seats.value.some((seat) => seat.id === id)) store.selectSeat(id)
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
  if (next) store.selectSeat(next.id)
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
          <RouterLink to="/" class="back-link">
            <v-icon icon="mdi-chevron-left" size="25" />
            {{ t('app.back') }}
          </RouterLink>
          <span class="viewer-map-page__count">{{
            t('seats.seatCount', { count: seats.length })
          }}</span>
        </div>

        <div class="viewer-map-page__heading">
          <span class="eyebrow">THEATGOOD / SEAT MAP</span>
          <h1>{{ seatName() }}</h1>
          <p>{{ venueName() }}</p>
          <span class="data-caption">{{
            isFestivalReference
              ? t('viewer.festivalReference')
              : isOfficial
                ? t('app.officialNote')
                : t('seats.demoNote')
          }}</span>
        </div>

        <section class="seat-map-panel">
          <SeatMap
            :key="auditorium.id"
            :auditorium="auditorium"
            :seats="seats"
            :selected-seat-id="store.selectedSeatId"
            @select-seat="selectSeat"
          />
        </section>

        <div class="map-provenance">
          <v-icon icon="mdi-information-outline" size="18" />
          <p>
            {{
              isFestivalReference
                ? t('viewer.festivalCountWarning')
                : isOfficial
                  ? t('seats.layoutNote')
                  : t('viewer.demoProvenance')
            }}
          </p>
          <a
            v-if="auditorium.sources.length"
            :href="auditorium.sources[0]"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ t('app.openSource') }}
            <v-icon icon="mdi-open-in-new" size="15" />
          </a>
        </div>
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
        <p class="viewer-immersive__hint">{{ t('viewer.drag') }}</p>
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
          <details class="viewer-details">
            <summary>
              {{ t('viewer.details') }} <v-icon icon="mdi-chevron-down" size="17" />
            </summary>
            <label class="viewer-fov-control">
              <span>{{ t('viewer.projectionFov') }}</span>
              <select v-model.number="horizontalFov">
                <option v-for="angle in horizontalFovPresets" :key="angle" :value="angle">
                  {{ angle }}°
                </option>
              </select>
            </label>
            <p class="viewer-fov-note">{{ t('viewer.projectionCaveat') }}</p>
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
              <div>
                <dt>{{ t('viewer.offset') }}</dt>
                <dd>{{ Math.abs(sightline.horizontalOffset).toFixed(1) }}°</dd>
              </div>
            </dl>
            <p>
              {{
                isFestivalReference
                  ? t('viewer.festivalCountWarning')
                  : isOfficial
                    ? t('viewer.provenance')
                    : t('viewer.demoProvenance')
              }}
            </p>
            <p v-if="isFestivalReference">{{ t('viewer.festivalWheelchair') }}</p>
            <p v-if="auditorium.id === 'tfai-small'">{{ t('viewer.wheelchair') }}</p>
            <p v-if="auditorium.id === 'spot-taipei'">{{ t('viewer.wheelchairSpot') }}</p>
          </details>
        </div>
      </div>
    </div>
  </div>
</template>
