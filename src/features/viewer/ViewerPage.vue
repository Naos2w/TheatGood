<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SeatMap from '../../components/SeatMap.vue'
import { demoAuditorium } from '../auditoriums/demo'
import { findAuditorium } from '../auditoriums/catalog'
import { calculateSightline, createSeats } from '../auditoriums/geometry'
import { useViewerStore } from '../../stores/viewer'

const ThreeCinemaScene = defineAsyncComponent(() => import('./ThreeCinemaScene.vue'))
const route = useRoute()
const router = useRouter()
const store = useViewerStore()

const auditorium = computed(
  () => findAuditorium(String(route.params.auditoriumId)) ?? demoAuditorium,
)
const seats = computed(() => createSeats(auditorium.value))
const selectedSeat = computed(
  () => seats.value.find((seat) => seat.id === store.selectedSeatId) ?? seats.value[0]!,
)
const sightline = computed(() => calculateSightline(selectedSeat.value, auditorium.value.screen))
const screenAspect = computed(() =>
  (auditorium.value.screen.width / auditorium.value.screen.height).toFixed(2),
)
const isOfficialVenue = computed(() => auditorium.value.provenance.seatLabels === 'official')
const qualityLabel = computed(() =>
  isOfficialVenue.value ? '部分官方資料・3D 估算' : '估算模型 DEMO',
)
const webglAvailable = ref(true)

watch(
  () => route.params.auditoriumId,
  (id) => {
    const next = findAuditorium(String(id))
    if (!next) {
      void router.replace('/cinemas')
      return
    }
    const nextSeats = createSeats(next)
    store.selectedSeatId = nextSeats.some((seat) => seat.id === 'E07')
      ? 'E07'
      : nextSeats[Math.floor(nextSeats.length / 2)]!.id
    store.showOverview()
  },
  { immediate: true },
)

onMounted(() => {
  try {
    const canvas = document.createElement('canvas')
    webglAvailable.value = Boolean(canvas.getContext('webgl2'))
  } catch {
    webglAvailable.value = false
  }
})

function selectSeat(id: string) {
  if (seats.value.some((seat) => seat.id === id)) store.selectSeat(id)
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
        <h1 class="page-title">{{ auditorium.name }}<span class="text-accent">.</span></h1>
        <div class="viewer-subtitle">
          <span>{{ auditorium.cinemaName }}</span>
          <span class="bullet-divider">/</span>
          <span>{{ auditorium.format }}</span>
          <span class="bullet-divider">/</span>
          <span>座位 {{ seats.length }} 席</span>
        </div>
      </div>
      <span class="quality-tag">
        <v-icon icon="mdi-alert-circle-outline" size="small" />
        {{ qualityLabel }}
      </span>
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
                :key="auditorium.id"
                :auditorium="auditorium"
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

        <section v-if="isOfficialVenue" class="verified-specs" aria-label="官方規格">
          <div class="verified-specs__item">
            <span>官方銀幕尺寸</span>
            <strong>
              {{ auditorium.screen.width.toFixed(2) }} × {{ auditorium.screen.height.toFixed(2) }} m
            </strong>
          </div>
          <div class="verified-specs__item">
            <span>銀幕寬高比</span>
            <strong>{{ screenAspect }}:1</strong>
          </div>
          <div class="verified-specs__item">
            <span>官方座位數</span>
            <strong>{{ auditorium.publishedSeatCount }} 席</strong>
          </div>
        </section>

        <section class="viewer-disclaimer">
          <v-icon icon="mdi-information-outline" color="primary" />
          <div>
            <strong>
              {{
                isOfficialVenue
                  ? '銀幕尺寸及座號來自官方；3D 排距、坡度與視角仍是估算。'
                  : '這是互動示範，非真實影廳測量。'
              }}
            </strong>
            <p>{{ auditorium.description }}</p>
            <p v-if="isOfficialVenue">
              設備手冊列有 52 席及另外 2 席輪椅席；輪椅空間尚未加入 3D 模型。
              原始設備手冊可能與現況不同，請以影城實際座位表為準。
            </p>
            <a
              v-if="auditorium.sources.length"
              :href="auditorium.sources[0]"
              target="_blank"
              rel="noopener noreferrer"
              class="source-link"
            >
              <v-icon icon="mdi-file-document-outline" size="small" />
              查看官方座位配置與尺寸來源
              <v-icon icon="mdi-open-in-new" size="x-small" />
            </a>
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
            :auditorium="auditorium"
            :seats="seats"
            :selected-seat-id="store.selectedSeatId"
            @select-seat="selectSeat"
          />
          <p v-if="isOfficialVenue" class="seat-map__caption">
            座號取自官方座位圖；位置間距為示意，非精確量測。
          </p>
        </section>

        <section class="sidebar-card data-card">
          <div class="sidebar-card__header">
            <div>
              <div class="eyebrow">ESTIMATED VIEWING ANGLE</div>
              <h2>{{ selectedSeat.row }} 排 · {{ selectedSeat.number }} 號</h2>
            </div>
            <v-icon icon="mdi-crosshairs-gps" color="primary" />
          </div>
          <div class="data-grid">
            <div class="data-grid__item">
              <small>估算距離銀幕</small>
              <strong>{{ sightline.distance.toFixed(1) }} <span>m</span></strong>
            </div>
            <div class="data-grid__item">
              <small>估算水平視角</small>
              <strong>{{ sightline.horizontalAngle.toFixed(1) }}<span>°</span></strong>
            </div>
            <div class="data-grid__item">
              <small>估算垂直視角</small>
              <strong>{{ sightline.verticalAngle.toFixed(1) }}<span>°</span></strong>
            </div>
            <div class="data-grid__item">
              <small>中央偏移角</small>
              <strong> {{ Math.abs(sightline.horizontalOffset).toFixed(1) }}<span>°</span> </strong>
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
