<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { TresCanvas } from '@tresjs/core'
import { PerspectiveCamera, Vector3 } from 'three'
import type { AuditoriumDefinition, AuditoriumSeat } from '../auditoriums/geometry'

const props = defineProps<{
  auditorium: AuditoriumDefinition
  seats: AuditoriumSeat[]
  selectedSeatId: string
  resetViewToken: number
}>()

const canvasBox = ref<HTMLElement | null>(null)
const camera = new PerspectiveCamera(55, 16 / 9, 0.1, 180)
const selected = computed(() => props.seats.find((seat) => seat.id === props.selectedSeatId))
const screen = computed(() => props.auditorium.screen)
const lastRowZ = computed(() => Math.max(...props.auditorium.rows.map((row) => row.z)))
const roomWidth = computed(() =>
  Math.max(screen.value.width + 3.5, ...props.seats.map((seat) => Math.abs(seat.x) * 2 + 3)),
)
const roomHeight = computed(() =>
  Math.max(
    screen.value.bottomY + screen.value.height + 2,
    ...props.auditorium.rows.map((row) => row.elevation + 4),
  ),
)
const roomDepth = computed(() => lastRowZ.value - screen.value.z + 7)
const roomCenterZ = computed(() => (lastRowZ.value + screen.value.z + 1) / 2)

const viewTarget = computed(
  () =>
    new Vector3(
      screen.value.centerX,
      screen.value.bottomY + screen.value.height / 2,
      screen.value.z,
    ),
)
let resizeObserver: ResizeObserver | undefined
let animationFrame = 0
let mounted = false
let yaw = 0
let pitch = 0
let activePointer: number | null = null
let lastPoint = { x: 0, y: 0 }

function orientCamera() {
  camera.lookAt(viewTarget.value)
  camera.rotateY(yaw)
  camera.rotateX(pitch)
  camera.updateMatrixWorld()
}

function moveToSelected() {
  if (!selected.value) return
  yaw = 0
  pitch = 0
  if (animationFrame) cancelAnimationFrame(animationFrame)
  const target = new Vector3(selected.value.x, selected.value.eyeY, selected.value.z)
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
  yaw = Math.max(-0.58, Math.min(0.58, yaw - dx * 0.0036))
  pitch = Math.max(-0.42, Math.min(0.42, pitch - dy * 0.0036))
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
  camera.fov = Math.min(91, Math.max(55, 55 / Math.max(camera.aspect, 0.62)))
  camera.updateProjectionMatrix()
}

watch(() => [props.selectedSeatId, props.auditorium.id], moveToSelected, { immediate: true })
watch(() => props.resetViewToken, resetView)

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
    <TresCanvas :camera="camera" clear-color="#080d16" :dpr="[1, 1.5]" antialias>
      <TresAmbientLight :intensity="1.55" />
      <TresDirectionalLight :position="[5, 15, 12]" :intensity="1.9" />
      <TresPointLight :position="[0, 9, 9]" color="#acc4f3" :intensity="55" />

      <TresMesh :position="[0, -0.3, roomCenterZ]" :rotation="[-Math.PI / 2, 0, 0]">
        <TresPlaneGeometry :args="[roomWidth, roomDepth]" />
        <TresMeshStandardMaterial color="#151c2d" />
      </TresMesh>
      <TresMesh
        v-for="wallX in [-roomWidth / 2, roomWidth / 2]"
        :key="wallX"
        :position="[wallX, roomHeight / 2, roomCenterZ]"
      >
        <TresBoxGeometry :args="[0.28, roomHeight, roomDepth]" />
        <TresMeshStandardMaterial color="#20293e" />
      </TresMesh>
      <TresMesh :position="[0, roomHeight / 2, screen.z - 0.35]">
        <TresBoxGeometry :args="[roomWidth, roomHeight, 0.5]" />
        <TresMeshStandardMaterial color="#111927" />
      </TresMesh>

      <TresMesh :position="[screen.centerX, screen.bottomY + screen.height / 2, screen.z - 0.13]">
        <TresBoxGeometry :args="[screen.width + 0.35, screen.height + 0.35, 0.24]" />
        <TresMeshStandardMaterial color="#a1a9b8" :metalness="0.35" :roughness="0.45" />
      </TresMesh>
      <TresMesh :position="[screen.centerX, screen.bottomY + screen.height / 2, screen.z + 0.02]">
        <TresPlaneGeometry :args="[screen.width, screen.height]" />
        <TresMeshBasicMaterial color="#c2cfe0" />
      </TresMesh>

      <TresMesh
        v-for="row in auditorium.rows"
        :key="row.label"
        :position="[0, row.elevation - 0.1, row.z]"
      >
        <TresBoxGeometry :args="[roomWidth - 0.7, 0.2, 1.6]" />
        <TresMeshStandardMaterial color="#273249" />
      </TresMesh>
      <TresGroup v-for="seat in seats" :key="seat.id" :position="[seat.x, seat.elevation, seat.z]">
        <TresMesh :position="[0, 0.42, 0.22]">
          <TresBoxGeometry :args="[auditorium.seatWidth, 0.75, 0.16]" />
          <TresMeshStandardMaterial
            :color="seat.id === selectedSeatId ? '#dfb77e' : '#43546f'"
            :roughness="0.74"
          />
        </TresMesh>
        <TresMesh :position="[0, 0.19, -0.1]">
          <TresBoxGeometry :args="[auditorium.seatWidth, 0.25, 0.66]" />
          <TresMeshStandardMaterial :color="seat.id === selectedSeatId ? '#cfa45d' : '#35445d'" />
        </TresMesh>
      </TresGroup>
    </TresCanvas>
  </div>
</template>
