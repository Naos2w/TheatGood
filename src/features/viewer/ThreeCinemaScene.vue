<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { TresCanvas } from '@tresjs/core'
import { OrbitControls } from '@tresjs/cientos'
import { PerspectiveCamera } from 'three'
import type { AuditoriumDefinition, AuditoriumSeat } from '../auditoriums/geometry'
import type { CameraMode } from '../../stores/viewer'

const props = defineProps<{
  auditorium: AuditoriumDefinition
  seats: AuditoriumSeat[]
  selectedSeatId: string
  cameraMode: CameraMode
}>()
const emit = defineEmits<{ 'select-seat': [seatId: string] }>()

const canvasBox = ref<HTMLElement | null>(null)
const camera = new PerspectiveCamera(55, 16 / 9, 0.1, 180)
const selected = computed(() => props.seats.find((seat) => seat.id === props.selectedSeatId))
const screen = computed(() => props.auditorium.screen)
let resizeObserver: ResizeObserver | undefined

function updateCameraPosition() {
  if (props.cameraMode === 'seat' && selected.value) {
    const seat = selected.value
    camera.position.set(seat.x, seat.eyeY, seat.z)
    camera.lookAt(
      screen.value.centerX,
      screen.value.bottomY + screen.value.height / 2,
      screen.value.z,
    )
  } else {
    camera.position.set(0, 13, 32)
    camera.lookAt(0, 1.4, 9)
  }
  camera.updateProjectionMatrix()
}

function resizeCamera() {
  if (!canvasBox.value) return
  const width = canvasBox.value.clientWidth
  const height = canvasBox.value.clientHeight
  if (!width || !height) return
  camera.aspect = width / height
  // Preserve a usable horizontal field of view when the canvas is portrait.
  camera.fov = Math.min(93, Math.max(55, 55 / Math.max(camera.aspect, 0.6)))
  camera.updateProjectionMatrix()
}

watch(() => [props.cameraMode, props.selectedSeatId], updateCameraPosition, { immediate: true })

onMounted(() => {
  resizeCamera()
  resizeObserver = new ResizeObserver(resizeCamera)
  if (canvasBox.value) resizeObserver.observe(canvasBox.value)
})
onUnmounted(() => resizeObserver?.disconnect())
</script>

<template>
  <div ref="canvasBox" class="cinema-canvas" aria-label="3D 影廳視角">
    <TresCanvas :camera="camera" clear-color="#090e1b" :dpr="[1, 1.75]" antialias>
      <TresAmbientLight :intensity="1.65" />
      <TresDirectionalLight :position="[5, 15, 12]" :intensity="2" />
      <TresPointLight :position="[0, 9, 9]" color="#acc4f3" :intensity="65" />

      <!-- Cinema floor and sidewalls. -->
      <TresMesh :position="[0, -0.3, 12]" :rotation="[-Math.PI / 2, 0, 0]">
        <TresPlaneGeometry :args="[28, 40]" />
        <TresMeshStandardMaterial color="#151c2d" />
      </TresMesh>
      <TresMesh v-for="wallX in [-13.5, 13.5]" :key="wallX" :position="[wallX, 5.5, 11]">
        <TresBoxGeometry :args="[0.28, 12, 39]" />
        <TresMeshStandardMaterial color="#20293e" />
      </TresMesh>
      <TresMesh :position="[0, 6.7, -0.3]">
        <TresBoxGeometry :args="[27, 14.5, 0.5]" />
        <TresMeshStandardMaterial color="#111927" />
      </TresMesh>

      <!-- Screen frame and illuminated screen. -->
      <TresMesh :position="[screen.centerX, screen.bottomY + screen.height / 2, screen.z - 0.13]">
        <TresBoxGeometry :args="[screen.width + 0.35, screen.height + 0.35, 0.24]" />
        <TresMeshStandardMaterial color="#a1a9b8" :metalness="0.35" :roughness="0.45" />
      </TresMesh>
      <TresMesh :position="[screen.centerX, screen.bottomY + screen.height / 2, screen.z + 0.02]">
        <TresPlaneGeometry :args="[screen.width, screen.height]" />
        <TresMeshBasicMaterial color="#c2cfe0" />
      </TresMesh>

      <!-- Row risers and seats. The 2D map uses the exact same seat coordinates. -->
      <TresMesh
        v-for="row in auditorium.rows"
        :key="row.label"
        :position="[0, row.elevation - 0.1, row.z]"
      >
        <TresBoxGeometry :args="[17.2, 0.2, 2.0]" />
        <TresMeshStandardMaterial color="#273249" />
      </TresMesh>
      <TresGroup v-for="seat in seats" :key="seat.id" :position="[seat.x, seat.elevation, seat.z]">
        <TresMesh :position="[0, 0.42, 0.22]" @click="emit('select-seat', seat.id)">
          <TresBoxGeometry :args="[auditorium.seatWidth, 0.75, 0.16]" />
          <TresMeshStandardMaterial
            :color="seat.id === selectedSeatId ? '#e1b970' : '#43546f'"
            :roughness="0.74"
          />
        </TresMesh>
        <TresMesh :position="[0, 0.19, -0.1]" @click="emit('select-seat', seat.id)">
          <TresBoxGeometry :args="[auditorium.seatWidth, 0.25, 0.66]" />
          <TresMeshStandardMaterial :color="seat.id === selectedSeatId ? '#cfa45d' : '#35445d'" />
        </TresMesh>
      </TresGroup>

      <OrbitControls
        v-if="cameraMode === 'overview'"
        :target="[0, 1.2, 8]"
        :min-distance="7"
        :max-distance="65"
        :enable-pan="false"
      />
    </TresCanvas>
    <div class="cinema-canvas__label">
      <span class="status-dot" /> {{ cameraMode === 'seat' ? 'FIRST PERSON VIEW' : 'FREE CAMERA' }}
    </div>
    <div class="cinema-canvas__corner">THEATGOOD / DEMO MODEL</div>
  </div>
</template>
