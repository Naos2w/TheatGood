<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'

/**
 * One-hall video pilot. Keep the original film audio separate from the screen
 * texture; the shared Three.js camera and seat data are owned by the viewer.
 */
defineProps<{
  selectedSeatId: string
  canPrevious: boolean
  canNext: boolean
  viewMode: 'seat' | 'overview'
}>()
const emit = defineEmits<{
  'video-element': [video: HTMLVideoElement | null]
  'previous-seat': []
  'next-seat': []
  'toggle-view-mode': []
  'reset-view': []
}>()

const ORIGINAL_WEBM_URL =
  'https://upload.wikimedia.org/wikipedia/commons/transcoded/b/b2/The_Daily_Dweebs_-_Blender_Open_Movie-full_movie.webm/The_Daily_Dweebs_-_Blender_Open_Movie-full_movie.webm.1080p.vp9.webm'
// Safari/WebKit can play some VP9 sources but still show a black WebGL video texture.
// Serve the same CC BY 4.0 film in H.264/AAC MP4 on Apple devices instead.
const appleBrowser =
  typeof navigator !== 'undefined' &&
  (/iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))
const MOVIE_URL = appleBrowser ? '/media/the-daily-dweebs-safari-720p.mp4' : ORIGINAL_WEBM_URL
const videoElement = ref<HTMLVideoElement | null>(null)
const playing = ref(false)
const playPending = ref(false)
const audioEnabled = ref(false)
const infoOpen = ref(false)
const mediaError = ref(false)
const elapsed = ref(0)
const duration = ref(60)
const message = ref('播放電影後，可選擇是否開啟原聲；不同座位的影像會切換，原片音軌保持不變。')

const progress = computed(() =>
  duration.value > 0 ? Math.min(100, (elapsed.value / duration.value) * 100) : 0,
)
function formatTime(seconds: number) {
  const n = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0))
  return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`
}

async function togglePlayback() {
  const video = videoElement.value
  if (!video || playPending.value) return
  if (playing.value) {
    video.pause()
    playing.value = false
    message.value = '已暫停影片；按播放可繼續。'
    return
  }
  playPending.value = true
  try {
    if (mediaError.value) video.load()
    mediaError.value = false
    if (video.ended) video.currentTime = 0
    await video.play()
    playing.value = true
    message.value = '正在影廳銀幕播放《The Daily Dweebs》。'
  } catch {
    playing.value = false
    message.value = '影片無法播放，可再按播放重試；3D 座位視角仍可使用。'
  } finally {
    playPending.value = false
  }
}

function toggleAudio() {
  const video = videoElement.value
  if (!video) return
  audioEnabled.value = !audioEnabled.value
  video.volume = 0.7
  video.muted = !audioEnabled.value
  message.value = audioEnabled.value
    ? '電影原聲已開啟；這是原始音軌，不會依座位改變。'
    : '電影原聲已靜音，影片仍可繼續播放。'
}
function resetViewAndClose() {
  emit('reset-view')
  infoOpen.value = false
}
function onMetadata() {
  const reported = videoElement.value?.duration
  duration.value = reported && Number.isFinite(reported) && reported > 0 ? reported : 60
}
function onMediaError() {
  mediaError.value = true
  playing.value = false
  message.value = '影片載入失敗，可按播放重試。'
}
function onVisibilityChange() {
  if (!document.hidden) return
  videoElement.value?.pause()
  playing.value = false
  if (videoElement.value) videoElement.value.muted = true
  audioEnabled.value = false
}
onMounted(async () => {
  document.addEventListener('visibilitychange', onVisibilityChange)
  await nextTick()
  emit('video-element', videoElement.value)
})
onUnmounted(() => {
  document.removeEventListener('visibilitychange', onVisibilityChange)
  videoElement.value?.pause()
  if (videoElement.value) videoElement.value.muted = true
  emit('video-element', null)
})
</script>

<template>
  <section class="cinema-sensory-pilot" aria-label="影廳影片與座位控制">
    <video
      ref="videoElement"
      class="cinema-sensory-pilot__media"
      crossorigin="anonymous"
      :src="MOVIE_URL"
      muted
      playsinline
      preload="metadata"
      @durationchange="onMetadata"
      @loadedmetadata="onMetadata"
      @timeupdate="elapsed = videoElement?.currentTime ?? 0"
      @ended="playing = false"
      @error="onMediaError"
    />
    <aside v-if="infoOpen" class="cinema-sensory-pilot__info" aria-label="影片資訊">
      <div class="cinema-sensory-pilot__info-top">
        <strong>觀影資訊</strong>
        <button type="button" aria-label="關閉影片資訊" @click="infoOpen = false">
          <v-icon icon="mdi-close" size="18" />
        </button>
      </div>
      <p>《The Daily Dweebs》｜Blender Foundation</p>
      <p>{{ formatTime(elapsed) }} / {{ formatTime(duration) }} · 座位 {{ selectedSeatId }}</p>
      <div class="cinema-sensory-pilot__progress" aria-hidden="true">
        <span :style="{ width: progress + '%' }" />
      </div>
      <p class="cinema-sensory-pilot__notice">{{ message }} 影廳比例和座位視角為估算模擬。</p>
      <p v-if="appleBrowser">Safari 相容版：影片已轉碼為 720p H.264/AAC，內容未剪輯。</p>
      <p>
        影片來源：
        <a
          href="https://commons.wikimedia.org/wiki/File:The_Daily_Dweebs_-_Blender_Open_Movie-full_movie.webm"
          target="_blank"
          rel="noopener noreferrer"
          >Wikimedia Commons</a
        >
        ·
        <a
          href="https://creativecommons.org/licenses/by/4.0/"
          target="_blank"
          rel="noopener noreferrer"
          >CC BY 4.0</a
        >
      </p>
      <button type="button" class="cinema-sensory-pilot__reset" @click="resetViewAndClose">
        <v-icon icon="mdi-restore" size="16" /> 重設視角
      </button>
    </aside>
    <div
      class="cinema-sensory-pilot__bar viewer-switcher glass-panel"
      role="group"
      aria-label="觀影控制"
    >
      <button
        type="button"
        class="cinema-sensory-pilot__control cinema-sensory-pilot__play"
        :disabled="playPending"
        :aria-label="playing ? '暫停影片' : '播放影片'"
        :title="playing ? '暫停影片' : '播放影片'"
        @click="togglePlayback"
      >
        <v-icon :icon="playing ? 'mdi-pause' : 'mdi-play'" size="21" />
      </button>
      <button
        type="button"
        class="cinema-sensory-pilot__control"
        :aria-pressed="audioEnabled"
        :aria-label="audioEnabled ? '關閉原聲' : '開啟原聲'"
        :title="audioEnabled ? '關閉原聲' : '開啟原聲'"
        @click="toggleAudio"
      >
        <v-icon :icon="audioEnabled ? 'mdi-volume-high' : 'mdi-volume-off'" size="20" />
      </button>
      <span class="cinema-sensory-pilot__separator" aria-hidden="true" />
      <button
        type="button"
        class="cinema-sensory-pilot__control"
        :disabled="!canPrevious"
        aria-label="上一個座位"
        title="上一個座位"
        @click="emit('previous-seat')"
      >
        <v-icon icon="mdi-chevron-left" size="25" />
      </button>
      <strong class="cinema-sensory-pilot__seat" aria-live="polite">{{ selectedSeatId }}</strong>
      <button
        type="button"
        class="cinema-sensory-pilot__control"
        :disabled="!canNext"
        aria-label="下一個座位"
        title="下一個座位"
        @click="emit('next-seat')"
      >
        <v-icon icon="mdi-chevron-right" size="25" />
      </button>
      <span class="cinema-sensory-pilot__separator" aria-hidden="true" />
      <button
        type="button"
        class="cinema-sensory-pilot__control"
        :aria-label="viewMode === 'seat' ? '全廳概覽' : '座位視角'"
        :title="viewMode === 'seat' ? '全廳概覽' : '座位視角'"
        @click="emit('toggle-view-mode')"
      >
        <v-icon
          :icon="viewMode === 'seat' ? 'mdi-view-dashboard-outline' : 'mdi-seat-recline-normal'"
          size="19"
        />
      </button>
      <button
        type="button"
        class="cinema-sensory-pilot__control"
        :aria-expanded="infoOpen"
        aria-label="影片資訊"
        title="影片資訊"
        @click="infoOpen = !infoOpen"
      >
        <v-icon icon="mdi-information-outline" size="20" />
      </button>
    </div>
    <span v-if="mediaError" class="cinema-sensory-pilot__error" role="status">
      影片載入失敗，按播放重試
    </span>
  </section>
</template>

<style scoped>
.cinema-sensory-pilot {
  position: absolute;
  z-index: 7;
  bottom: calc(14px + env(safe-area-inset-bottom));
  right: max(18px, env(safe-area-inset-right));
  width: min(390px, calc(100% - 28px));
  pointer-events: none;
}
.cinema-sensory-pilot__media {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}
.cinema-sensory-pilot .cinema-sensory-pilot__bar.viewer-switcher.glass-panel {
  position: relative;
  width: 100%;
  height: 60px;
  padding: 6px;
  margin: 0;
  border-radius: 23px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2px;
  pointer-events: auto;
  touch-action: manipulation;
  background:
    linear-gradient(120deg, rgba(139, 179, 220, 0.17), rgba(22, 37, 53, 0.28) 68%),
    rgba(20, 30, 44, 0.32);
  border: 1px solid rgba(249, 252, 255, 0.46);
  box-shadow:
    0 10px 26px rgba(0, 7, 19, 0.27),
    inset 0 1px 0 rgba(255, 255, 255, 0.44);
  -webkit-backdrop-filter: blur(19px) saturate(175%) contrast(1.04);
  backdrop-filter: blur(19px) saturate(175%) contrast(1.04);
}
.cinema-sensory-pilot .cinema-sensory-pilot__control {
  flex: 0 0 40px;
  width: 40px;
  min-width: 0;
  height: 44px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 15px;
  background: rgba(255, 255, 255, 0.1);
  color: #f5f9ff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}
.cinema-sensory-pilot .cinema-sensory-pilot__control:focus-visible,
.cinema-sensory-pilot__info button:focus-visible,
.cinema-sensory-pilot__info a:focus-visible {
  outline: 2px solid #a9d5ff;
  outline-offset: 2px;
}
.cinema-sensory-pilot .cinema-sensory-pilot__control:disabled {
  opacity: 0.3;
}
.cinema-sensory-pilot .cinema-sensory-pilot__play {
  background: rgba(245, 203, 148, 0.87);
  color: #1d2939;
}
.cinema-sensory-pilot .cinema-sensory-pilot__control[aria-pressed='true'] {
  background: rgba(241, 195, 134, 0.22);
  border-color: rgba(241, 195, 134, 0.45);
}
.cinema-sensory-pilot__seat {
  flex: 0 0 auto;
  min-width: 40px;
  text-align: center;
  font-size: 14px;
  font-weight: 750;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.1px;
  color: #fff;
  text-shadow: 0 1px 4px #0a1020;
}
.cinema-sensory-pilot__separator {
  flex: 0 0 1px;
  height: 19px;
  background: rgba(244, 250, 255, 0.3);
}
.cinema-sensory-pilot__info {
  pointer-events: auto;
  position: absolute;
  right: 0;
  bottom: 70px;
  width: min(310px, 100%);
  max-height: min(43dvh, 250px);
  overflow-y: auto;
  padding: 14px;
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 19px;
  background: rgba(21, 32, 48, 0.72);
  color: #eef4fe;
  box-shadow:
    0 16px 40px #0006,
    inset 0 1px 0 rgba(255, 255, 255, 0.25);
  -webkit-backdrop-filter: blur(24px) saturate(155%);
  backdrop-filter: blur(24px) saturate(155%);
}
.cinema-sensory-pilot__info-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.cinema-sensory-pilot__info-top button,
.cinema-sensory-pilot__reset {
  padding: 5px 8px;
  color: #f6f8ff;
  background: rgba(255, 255, 255, 0.09);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 9px;
}
.cinema-sensory-pilot__info p {
  margin: 7px 0 0;
  font-size: 11px;
  line-height: 1.55;
  color: #cdd8e9;
}
.cinema-sensory-pilot__info a {
  color: #ffdbb0;
}
.cinema-sensory-pilot__progress {
  height: 3px;
  background: #d8e3fa44;
  border-radius: 10px;
  overflow: hidden;
  margin-top: 8px;
}
.cinema-sensory-pilot__progress span {
  display: block;
  height: 100%;
  background: #f0c491;
}
.cinema-sensory-pilot__reset {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 9px;
  font-size: 11px;
}
.cinema-sensory-pilot__error {
  pointer-events: none;
  position: absolute;
  bottom: 68px;
  right: 0;
  max-width: 100%;
  padding: 7px 10px;
  background: rgba(30, 42, 59, 0.87);
  color: #ffdfbc;
  font-size: 11px;
  border-radius: 10px;
}
@media (max-width: 599px) {
  .cinema-sensory-pilot {
    left: 50%;
    right: auto;
    bottom: calc(10px + env(safe-area-inset-bottom));
    transform: translateX(-50%);
    width: min(380px, calc(100% - 20px - env(safe-area-inset-left) - env(safe-area-inset-right)));
  }
}
@media (max-width: 359px) {
  .cinema-sensory-pilot .cinema-sensory-pilot__bar.viewer-switcher.glass-panel {
    height: 58px;
    padding: 5px;
  }
  .cinema-sensory-pilot .cinema-sensory-pilot__control {
    flex-basis: 34px;
    width: 34px;
    height: 42px;
    border-radius: 12px;
  }
  .cinema-sensory-pilot__seat {
    min-width: 36px;
    font-size: 13px;
  }
}
@media (prefers-reduced-transparency: reduce) {
  .cinema-sensory-pilot .cinema-sensory-pilot__bar.viewer-switcher.glass-panel,
  .cinema-sensory-pilot__info {
    background: rgba(23, 35, 49, 0.96);
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }
}
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .cinema-sensory-pilot .cinema-sensory-pilot__bar.viewer-switcher.glass-panel,
  .cinema-sensory-pilot__info {
    background: rgba(22, 31, 46, 0.96);
  }
}
</style>
