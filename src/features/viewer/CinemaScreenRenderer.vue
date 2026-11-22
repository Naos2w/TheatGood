<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef, watch } from 'vue'
import { CanvasTexture, LinearFilter, SRGBColorSpace, VideoTexture } from 'three'
import type { ScreenDefinition } from '../auditoriums/schema'
import type { CinemaRoomLayout } from './cinema-room-layout'
import { createCinemaScreenTexture } from './cinema-screen-texture'
import { deriveScreenProjection } from '../auditoriums/screen-projection'

const props = defineProps<{
  screen: ScreenDefinition
  room: CinemaRoomLayout
  /** Only set for selected source-verified halls; others keep the procedural screen texture. */
  demoVideo?: HTMLVideoElement | null
}>()

const projectionTexture = shallowRef<CanvasTexture | null>(null)
const videoTexture = shallowRef<VideoTexture | null>(null)
const selectedTexture = computed(() => videoTexture.value ?? projectionTexture.value)
const projection = computed(() => deriveScreenProjection(props.screen))

onMounted(() => {
  try {
    projectionTexture.value = createCinemaScreenTexture()
  } catch {
    // Retain the plain screen material when Canvas 2D is unavailable.
    projectionTexture.value = null
  }
})

watch(
  () => props.demoVideo,
  (video, _previous, onCleanup) => {
    const release = () => {
      const current = videoTexture.value
      videoTexture.value = null
      current?.dispose()
    }
    release()
    if (!video) return
    const create = () => {
      if (videoTexture.value || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return
      const texture = new VideoTexture(video)
      texture.colorSpace = SRGBColorSpace
      texture.minFilter = LinearFilter
      texture.magFilter = LinearFilter
      texture.generateMipmaps = false
      videoTexture.value = texture
    }
    video.addEventListener('loadeddata', create)
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) create()
    onCleanup(() => {
      video.removeEventListener('loadeddata', create)
      release()
    })
  },
  { immediate: true },
)

onUnmounted(() => {
  videoTexture.value?.dispose()
  projectionTexture.value?.dispose()
})
</script>

<template>
  <TresGroup>
    <TresMesh
      :position="[screen.centerX, projection.centreY, screen.z - 0.1]"
      :rotation="[projection.rotationX, 0, 0]"
    >
      <TresBoxGeometry :args="[screen.width + 0.52, screen.height + 0.52, 0.18]" />
      <TresMeshStandardMaterial color="#0a0d15" :roughness="0.86" />
    </TresMesh>
    <TresMesh
      :position="[screen.centerX, projection.centreY, screen.z + 0.018]"
      :rotation="[projection.rotationX, 0, 0]"
    >
      <TresPlaneGeometry :args="[projection.width, projection.height]" />
      <TresMeshBasicMaterial v-if="selectedTexture" :map="selectedTexture" />
      <TresMeshBasicMaterial v-else color="#718ba8" />
    </TresMesh>
    <TresMesh :position="[0, -0.1, screen.z + 1.2]">
      <TresBoxGeometry :args="[Math.min(room.roomWidth - 1, screen.width + 1.8), 0.2, 2.2]" />
      <TresMeshStandardMaterial color="#141c2b" :roughness="0.94" />
    </TresMesh>
  </TresGroup>
</template>
