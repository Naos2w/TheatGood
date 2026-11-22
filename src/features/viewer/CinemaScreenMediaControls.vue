<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

// Original film: Blender Foundation, The Daily Dweebs (2017), CC BY 4.0.
// Reuse the existing local H.264/AAC conversion so the screen texture and
// original soundtrack work without third-party cross-origin video requests.
const DEMO_VIDEO = '/media/the-daily-dweebs-safari-720p.mp4'
const SOURCE =
  'https://commons.wikimedia.org/wiki/File:The_Daily_Dweebs_-_Blender_Open_Movie-full_movie.webm'
const LICENCE = 'https://creativecommons.org/licenses/by/4.0/'

defineProps<{ english: boolean }>()
const emit = defineEmits<{ 'video-element': [video: HTMLVideoElement | null] }>()
const videoElement = ref<HTMLVideoElement | null>(null)
const isPlaying = ref(false)
const soundEnabled = ref(false)
const playPending = ref(false)
const playbackError = ref(false)
const infoOpen = ref(false)

async function togglePlay() {
  const video = videoElement.value
  if (!video || playPending.value) return
  if (!video.paused) {
    video.pause()
    return
  }
  playPending.value = true
  playbackError.value = false
  try {
    if (video.ended) video.currentTime = 0
    await video.play()
  } catch {
    playbackError.value = true
  } finally {
    playPending.value = false
  }
}

function toggleSound() {
  const video = videoElement.value
  if (!video) return
  soundEnabled.value = !soundEnabled.value
  video.volume = 0.7
  video.muted = !soundEnabled.value
}

function onVisibilityChange() {
  if (!document.hidden) return
  videoElement.value?.pause()
  if (videoElement.value) videoElement.value.muted = true
  soundEnabled.value = false
  infoOpen.value = false
}

onMounted(() => {
  document.addEventListener('visibilitychange', onVisibilityChange)
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
  <div
    class="cinema-media-controls"
    role="group"
    :aria-label="english ? 'Film preview controls' : '示範影片控制'"
  >
    <video
      ref="videoElement"
      class="cinema-media-controls__video"
      :src="DEMO_VIDEO"
      crossorigin="anonymous"
      muted
      playsinline
      preload="metadata"
      @play="isPlaying = true"
      @pause="isPlaying = false"
      @ended="isPlaying = false"
      @error="playbackError = true"
    />
    <div class="cinema-media-controls__bar">
      <button
        class="cinema-media-controls__play"
        type="button"
        :disabled="playPending"
        :aria-label="
          isPlaying
            ? english
              ? 'Pause sample film'
              : '暫停示範影片'
            : english
              ? 'Play sample film'
              : '播放示範影片'
        "
        :title="
          isPlaying ? (english ? 'Pause film' : '暫停影片') : english ? 'Play film' : '播放影片'
        "
        @click="togglePlay"
      >
        <v-icon :icon="isPlaying ? 'mdi-pause' : 'mdi-play'" size="20" aria-hidden="true" />
      </button>
      <button
        type="button"
        :aria-pressed="soundEnabled"
        :aria-label="
          soundEnabled
            ? english
              ? 'Mute original soundtrack'
              : '關閉影片原聲'
            : english
              ? 'Enable original soundtrack'
              : '開啟影片原聲'
        "
        :title="
          soundEnabled
            ? english
              ? 'Mute soundtrack'
              : '關閉原聲'
            : english
              ? 'Enable soundtrack'
              : '開啟原聲'
        "
        @click="toggleSound"
      >
        <v-icon
          :icon="soundEnabled ? 'mdi-volume-high' : 'mdi-volume-off'"
          size="20"
          aria-hidden="true"
        />
      </button>
      <button
        type="button"
        :aria-expanded="infoOpen"
        :aria-label="english ? 'Sample film credits' : '影片來源與授權'"
        :title="english ? 'Credits' : '來源'"
        @click="infoOpen = !infoOpen"
      >
        <v-icon icon="mdi-information-outline" size="18" aria-hidden="true" />
      </button>
    </div>
    <div v-if="infoOpen || playbackError" class="cinema-media-controls__info" role="status">
      <p v-if="playbackError">
        {{
          english
            ? 'The sample film could not play. The 3D seating view is still available.'
            : '示範影片暫時無法播放，3D 座位視角仍可使用。'
        }}
      </p>
      <template v-if="infoOpen">
        <strong>The Daily Dweebs — Blender Foundation (2017)</strong>
        <p>
          {{
            english
              ? 'Original soundtrack; not measured cinema surround sound. Local 720p H.264/AAC compatibility conversion, with no edits to the story.'
              : '影片原始音軌，非實測影城環繞音效。使用本機 720p H.264/AAC 相容轉碼，未剪輯故事內容。'
          }}
        </p>
        <p>
          <a :href="SOURCE" target="_blank" rel="noopener noreferrer">Wikimedia Commons</a>
          ·
          <a :href="LICENCE" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>
        </p>
      </template>
    </div>
  </div>
</template>

<style scoped>
.cinema-media-controls {
  position: relative;
  flex: 0 0 120px;
  width: 120px;
  height: 46px;
  pointer-events: auto;
}
.cinema-media-controls__video {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}
.cinema-media-controls__bar {
  height: 46px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  padding: 3px;
  border: 1px solid rgba(230, 239, 252, 0.22);
  border-radius: 16px;
  background: rgba(18, 29, 43, 0.73);
  color: #f4f7fc;
  box-shadow:
    0 10px 25px rgba(0, 7, 19, 0.2),
    inset 0 1px rgba(255, 255, 255, 0.16);
  -webkit-backdrop-filter: blur(20px) saturate(145%);
  backdrop-filter: blur(20px) saturate(145%);
}
.cinema-media-controls__bar button {
  width: 35px;
  height: 40px;
  flex: 0 0 35px;
  padding: 0;
  color: inherit;
  background: rgba(250, 252, 255, 0.07);
  border: 1px solid transparent;
  border-radius: 12px;
  display: grid;
  place-items: center;
  touch-action: manipulation;
}
.cinema-media-controls__bar button:focus-visible,
.cinema-media-controls__info a:focus-visible {
  outline: 2px solid #d8b083;
  outline-offset: 2px;
}
.cinema-media-controls__bar button:disabled {
  opacity: 0.45;
}
.cinema-media-controls__bar .cinema-media-controls__play {
  color: #182435;
  background: #dfbb8e;
}
.cinema-media-controls__bar button[aria-pressed='true'] {
  border-color: rgba(223, 187, 142, 0.66);
  background: rgba(223, 187, 142, 0.2);
}
.cinema-media-controls__info {
  position: absolute;
  left: 0;
  top: calc(100% + 9px);
  z-index: 15;
  width: min(286px, calc(100vw - 32px));
  padding: 12px;
  border-radius: 15px;
  border: 1px solid rgba(232, 239, 249, 0.3);
  background: rgba(23, 34, 49, 0.95);
  color: #f3f5f9;
  font-size: 11px;
  line-height: 1.55;
  box-shadow: 0 12px 26px rgba(0, 0, 0, 0.25);
}
.cinema-media-controls__info p {
  margin: 7px 0 0;
}
.cinema-media-controls__info a {
  color: #f4cda2;
}
@media (max-width: 1023px) {
  .cinema-media-controls__info {
    top: auto;
    bottom: calc(100% + 9px);
  }
}
@media (prefers-reduced-transparency: reduce) {
  .cinema-media-controls__bar {
    background: #182538;
    backdrop-filter: none;
  }
  .cinema-media-controls__info {
    background: #172231;
  }
}
</style>
