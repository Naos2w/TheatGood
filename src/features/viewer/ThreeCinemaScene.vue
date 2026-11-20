<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { TresCanvas } from '@tresjs/core'
import { PerspectiveCamera } from 'three'
import type { AuditoriumSeat } from '../auditoriums/geometry'
import type { CinemaWheelchairSpot, SceneAuditoriumGeometry } from './cinema-scene-model'
import {
  cinemaCameraDirection,
  cinemaCameraPosition,
  cinemaCameraTarget,
  type CinemaEyeAim,
} from './cinema-camera'
import { responsiveCinemaFov } from './view-projection'
import { deriveCinemaRoomLayout } from './cinema-room-layout'
import CinemaRoomRenderer from './CinemaRoomRenderer.vue'
import CinemaScreenRenderer from './CinemaScreenRenderer.vue'
import CinemaSeatsRenderer from './CinemaSeatsRenderer.vue'

const props = defineProps<{
  auditorium: SceneAuditoriumGeometry
  seats: AuditoriumSeat[]
  selectedSeatId: string
  resetViewToken: number
  horizontalFov: number
  /** Natural level gaze or a deliberate look towards the screen centre. */
  eyeAim?: CinemaEyeAim
  viewMode?: 'seat' | 'overview'
  wheelchairSpots?: CinemaWheelchairSpot[]
  demoVideo?: HTMLVideoElement | null
}>()
const emit = defineEmits<{ 'orientation-change': [yaw: number, pitch: number] }>()

const canvasBox = ref<HTMLElement | null>(null)
const camera = new PerspectiveCamera(55, 16 / 9, 0.08, 220)
const selected = computed(() => props.seats.find((seat) => seat.id === props.selectedSeatId))
const screen = computed(() => props.auditorium.screen)
const room = computed(() =>
  deriveCinemaRoomLayout(props.auditorium, props.seats, props.wheelchairSpots ?? []),
)
const selectedRow = computed(() =>
  room.value.tiers.find((tier) => tier.row === selected.value?.row),
)

let resizeObserver: ResizeObserver | undefined
let animationFrame = 0
let mounted = false
let yaw = 0
let pitch = 0
let activePointer: number | null = null
let lastPoint = { x: 0, y: 0 }

function orientCamera() {
  const target = cinemaCameraTarget(
    screen.value,
    room.value,
    props.viewMode ?? 'seat',
    camera.aspect,
  )
  const direction = cinemaCameraDirection(
    camera.position,
    target,
    yaw,
    pitch,
    props.viewMode === 'overview' ? 'screen-centre' : (props.eyeAim ?? 'eye-level'),
  )
  camera.up.set(0, 1, 0)
  camera.lookAt(camera.position.clone().add(direction))
  camera.updateMatrixWorld()
}

function moveToSelected() {
  if (!selected.value) return
  yaw = 0
  pitch = 0
  emit('orientation-change', yaw, pitch)
  if (animationFrame) cancelAnimationFrame(animationFrame)
  const target = cinemaCameraPosition(selected.value, room.value, props.viewMode ?? 'seat')
  const reduceMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (!mounted || reduceMotion) {
    camera.position.copy(target)
    orientCamera()
    return
  }

  const start = camera.position.clone()
  const startTime = performance.now()
  const duration = 340
  function frame(now: number) {
    const progress = Math.min(1, (now - startTime) / duration)
    const eased = 1 - Math.pow(1 - progress, 3)
    camera.position.lerpVectors(start, target, eased)
    orientCamera()
    if (progress < 1) animationFrame = requestAnimationFrame(frame)
    else animationFrame = 0
  }
  animationFrame = requestAnimationFrame(frame)
}

function resetView() {
  yaw = 0
  pitch = 0
  emit('orientation-change', yaw, pitch)
  orientCamera()
}

function pointerDown(event: PointerEvent) {
  if (activePointer !== null || (event.pointerType === 'mouse' && event.button !== 0)) return
  activePointer = event.pointerId
  lastPoint = { x: event.clientX, y: event.clientY }
  canvasBox.value?.setPointerCapture(event.pointerId)
}

function pointerMove(event: PointerEvent) {
  if (event.pointerId !== activePointer) return
  const dx = event.clientX - lastPoint.x
  const dy = event.clientY - lastPoint.y
  lastPoint = { x: event.clientX, y: event.clientY }
  const newYaw = yaw - dx * 0.004
  yaw = Math.atan2(Math.sin(newYaw), Math.cos(newYaw))
  pitch = Math.max(-0.9, Math.min(0.9, pitch - dy * 0.0036))
  emit('orientation-change', yaw, pitch)
  orientCamera()
}

function pointerUp(event: PointerEvent) {
  if (activePointer === event.pointerId) activePointer = null
}

function resizeCamera() {
  const box = canvasBox.value
  if (!box) return
  const width = box.clientWidth
  const height = box.clientHeight
  if (!width || !height) return
  camera.aspect = width / height
  camera.fov = responsiveCinemaFov(props.horizontalFov, width, height).verticalDegrees
  camera.updateProjectionMatrix()
  if (props.viewMode === 'overview') orientCamera()
}

watch(
  () => [
    props.selectedSeatId,
    props.auditorium.id,
    props.viewMode,
    selected.value?.x,
    selected.value?.z,
    selected.value?.eyeY,
    screen.value.width,
    screen.value.height,
    screen.value.bottomY,
  ],
  moveToSelected,
  { immediate: true },
)
watch(() => props.resetViewToken, resetView)
watch(() => props.eyeAim, resetView)
watch(() => props.horizontalFov, resizeCamera)

onMounted(() => {
  mounted = true
  resizeCamera()
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(resizeCamera)
    if (canvasBox.value) resizeObserver.observe(canvasBox.value)
  }
})
onUnmounted(() => {
  mounted = false
  resizeObserver?.disconnect()
  if (animationFrame) cancelAnimationFrame(animationFrame)
})
</script>

<template>
  <div
    ref="canvasBox"
    class="cinema-canvas"
    aria-hidden="true"
    @pointerdown="pointerDown"
    @pointermove="pointerMove"
    @pointerup="pointerUp"
    @pointercancel="pointerUp"
  >
    <TresCanvas :camera="camera" clear-color="#070912" :dpr="[1, 1.4]" antialias>
      <TresAmbientLight :intensity="0.76" />
      <TresDirectionalLight :position="[3, 12, 5]" :intensity="0.68" color="#a8bed5" />
      <TresPointLight
        :position="[0, screen.bottomY + screen.height * 0.68, screen.z + 2.2]"
        color="#d4dfff"
        :intensity="Math.min(55, 20 + screen.width * 1.2)"
        :distance="Math.max(13, screen.width * 1.3)"
      />
      <TresPointLight
        :position="[0, room.roomHeight - 1.2, room.rearWallZ - 2]"
        color="#e5a66b"
        :intensity="8"
        :distance="room.roomDepth * 0.48"
      />
      <CinemaRoomRenderer :room="room" :wheelchair-spots="wheelchairSpots" />
      <CinemaScreenRenderer :screen="screen" :room="room" :demo-video="demoVideo" />
      <CinemaSeatsRenderer :seats="seats" :seat-width="auditorium.seatWidth" />

      <!-- The selected seat stays in the same physical coordinate system. -->
      <TresMesh
        v-if="selected && viewMode === 'overview'"
        :position="[selected.x, selected.elevation + 1.52, selected.z]"
      >
        <TresSphereGeometry :args="[0.14, 12, 8]" />
        <TresMeshBasicMaterial color="#ffd59b" />
      </TresMesh>
      <TresMesh
        v-if="selected && selectedRow"
        :position="[selected.x, selectedRow.elevation + 0.022, selected.z]"
        :rotation="[-Math.PI / 2, 0, 0]"
      >
        <TresRingGeometry :args="[0.32, 0.4, 24]" />
        <TresMeshBasicMaterial color="#ffe0a5" :depth-write="false" />
      </TresMesh>
    </TresCanvas>
  </div>
</template>
