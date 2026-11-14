<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref } from 'vue'
import SeatMap from '../../components/SeatMap.vue'
import { demoAuditorium } from '../auditoriums/demo'
import { calculateSightline, createSeats } from '../auditoriums/geometry'
import { useViewerStore } from '../../stores/viewer'

const ThreeCinemaScene = defineAsyncComponent(() => import('./ThreeCinemaScene.vue'))
const store = useViewerStore()
const seats = createSeats(demoAuditorium)
const selectedSeat = computed(
  () => seats.find((seat) => seat.id === store.selectedSeatId) ?? seats[0]!,
)
const sightline = computed(() => calculateSightline(selectedSeat.value, demoAuditorium.screen))
const webglAvailable = ref(true)

onMounted(() => {
  try {
    const canvas = document.createElement('canvas')
    webglAvailable.value = Boolean(canvas.getContext('webgl2'))
  } catch {
    webglAvailable.value = false
  }
})

function selectSeat(id: string) {
  if (seats.some((seat) => seat.id === id)) store.selectSeat(id)
}
</script>

<template>
  <div class="container viewer-page">
    <div class="viewer-top">
      <div>
        <div class="breadcrumbs">
          <RouterLink to="/cinemas">探索影廳</RouterLink>
          <v-icon icon="mdi-chevron-right" size="small" />
          <span>3D VIEWER</span>
        </div>
        <h1 class="page-title">{{ demoAuditorium.name }}<span class="text-accent">.</span></h1>
        <div class="viewer-subtitle">
          <span>{{ demoAuditorium.cinemaName }}</span>
          <span class="bullet-divider">/</span>
          <span>{{ demoAuditorium.format }}</span>
          <span class="bullet-divider">/</span>
          <span>座位 {{ seats.length }} 席</span>
        </div>
      </div>
      <span class="quality-tag"
        ><v-icon icon="mdi-alert-circle-outline" size="small" /> 估算模型 DEMO</span
      >
    </div>

    <div class="viewer-grid">
      <div class="viewer-main">
        <section class="scene-panel">
          <div class="scene-toolbar">
            <div class="scene-toolbar__title">
              <v-icon icon="mdi-cube-outline" size="small" /> 3D AUDITORIUM
            </div>
            <div class="scene-toolbar__actions">
              <v-btn
                size="small"
                :variant="store.cameraMode === 'overview' ? 'flat' : 'text'"
                :color="store.cameraMode === 'overview' ? 'primary' : undefined"
                @click="store.showOverview()"
              >
                <v-icon icon="mdi-rotate-3d-variant" start /> 自由視角
              </v-btn>
              <v-btn
                size="small"
                :variant="store.cameraMode === 'seat' ? 'flat' : 'text'"
                :color="store.cameraMode === 'seat' ? 'primary' : undefined"
                @click="store.showSelectedSeat()"
              >
                <v-icon icon="mdi-eye-outline" start /> 座位視角
              </v-btn>
            </div>
          </div>
          <div v-if="webglAvailable" class="scene-viewport">
            <Suspense>
              <ThreeCinemaScene
                :auditorium="demoAuditorium"
                :seats="seats"
                :selected-seat-id="store.selectedSeatId"
                :camera-mode="store.cameraMode"
                @select-seat="selectSeat"
              />
              <template #fallback>
                <div class="scene-placeholder">正在載入 3D 影廳…</div>
              </template>
            </Suspense>
          </div>
          <div v-else class="scene-viewport scene-placeholder">
            此裝置不支援 WebGL 2。你仍然可以使用下方座位圖選位。
          </div>
          <div class="scene-footnote">
            <v-icon icon="mdi-gesture-swipe" size="small" />
            {{
              store.cameraMode === 'seat'
                ? '目前從選定座位朝向銀幕中央觀看'
                : '拖曳旋轉視角，滾輪或雙指縮放。點選椅子可切換座位。'
            }}
          </div>
        </section>

        <section class="viewer-disclaimer">
          <v-icon icon="mdi-information-outline" color="primary" />
          <div>
            <strong>這是互動示範，非真實影廳測量。</strong>
            <p>
              {{ demoAuditorium.description }}
              銀幕距離、視角及座位坡度均依模型估算，不等於現場體驗。
            </p>
          </div>
        </section>
      </div>

      <aside class="viewer-sidebar">
        <section class="sidebar-card">
          <div class="sidebar-card__header">
            <div>
              <div class="eyebrow">CHOOSE YOUR SEAT</div>
              <h2>選擇座位</h2>
            </div>
            <span class="seat-id">{{ selectedSeat.id }}</span>
          </div>
          <SeatMap
            :auditorium="demoAuditorium"
            :seats="seats"
            :selected-seat-id="store.selectedSeatId"
            @select-seat="selectSeat"
          />
        </section>

        <section class="sidebar-card data-card">
          <div class="sidebar-card__header">
            <div>
              <div class="eyebrow">YOUR VIEWING ANGLE</div>
              <h2>{{ selectedSeat.row }} 排 · {{ selectedSeat.number }} 號</h2>
            </div>
            <v-icon icon="mdi-crosshairs-gps" color="primary" />
          </div>
          <div class="data-grid">
            <div class="data-grid__item">
              <small>距離銀幕</small
              ><strong>{{ sightline.distance.toFixed(1) }} <span>m</span></strong>
            </div>
            <div class="data-grid__item">
              <small>水平視角</small
              ><strong>{{ sightline.horizontalAngle.toFixed(1) }}<span>°</span></strong>
            </div>
            <div class="data-grid__item">
              <small>垂直視角</small
              ><strong>{{ sightline.verticalAngle.toFixed(1) }}<span>°</span></strong>
            </div>
            <div class="data-grid__item">
              <small>中央偏移角</small
              ><strong>{{ Math.abs(sightline.horizontalOffset).toFixed(1) }}<span>°</span></strong>
            </div>
          </div>
          <v-btn color="primary" block size="large" rounded="lg" @click="store.showSelectedSeat()">
            <v-icon start icon="mdi-eye-outline" /> 從 {{ selectedSeat.id }} 觀看
          </v-btn>
        </section>
      </aside>
    </div>
  </div>
</template>
