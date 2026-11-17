<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { TresCanvas } from '@tresjs/core'
import { Group, PerspectiveCamera, Vector3, type CanvasTexture } from 'three'
import type { AuditoriumSeat } from '../auditoriums/geometry'
import type { SceneAuditoriumGeometry } from './vieshow-approximate-scene'
import { verticalFovFromHorizontal } from './view-projection'
import { deriveCinemaRoomLayout } from './cinema-room-layout'
import { createCinemaSeatInstances, disposeCinemaSeatInstances } from './cinema-seat-instances'
import { createCinemaScreenTexture } from './cinema-screen-texture'

const props = defineProps<{
  auditorium: SceneAuditoriumGeometry
  seats: AuditoriumSeat[]
  selectedSeatId: string
  resetViewToken: number
  horizontalFov: number
  viewMode?: 'seat' | 'overview'
  wheelchairSpots?: { x: number; z: number; elevation: number }[]
}>()

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
const seatInstances = shallowRef<Group | null>(null)
const projectionTexture = shallowRef<CanvasTexture | null>(null)

const viewTarget = computed(() =>
  props.viewMode === 'overview'
    ? new Vector3(
        screen.value.centerX,
        Math.max(1.4, room.value.roomHeight * 0.31),
        room.value.frontWallZ + room.value.roomDepth * 0.29,
      )
    : new Vector3(
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
  // Compose sightline-relative yaw in world space so looking behind the seat
  // cannot accidentally roll or invert the floor/ceiling orientation.
  const targetPosition = viewTarget.value.clone()
  if (props.viewMode === 'overview' && camera.aspect < 0.7) {
    // Portrait has a very wide vertical FOV when horizontal FOV is fixed.
    // Aim lower so the auditorium rather than the dark ceiling fills the frame.
    targetPosition.y = Math.max(0.85, room.value.roomHeight * 0.12)
  }
  const towardsScreen = targetPosition.sub(camera.position)
  const horizontalDistance = Math.hypot(towardsScreen.x, towardsScreen.z)
  const baseYaw = Math.atan2(towardsScreen.x, -towardsScreen.z)
  const basePitch = Math.atan2(towardsScreen.y, horizontalDistance)
  const rotatedYaw = baseYaw + yaw
  const rotatedPitch = Math.max(-1.25, Math.min(1.25, basePitch + pitch))
  const direction = new Vector3(
    Math.sin(rotatedYaw) * Math.cos(rotatedPitch),
    Math.sin(rotatedPitch),
    -Math.cos(rotatedYaw) * Math.cos(rotatedPitch),
  )
  camera.up.set(0, 1, 0)
  camera.lookAt(camera.position.clone().add(direction))
  camera.updateMatrixWorld()
}

function moveToSelected() {
  if (!selected.value) return
  yaw = 0
  pitch = 0
  if (animationFrame) cancelAnimationFrame(animationFrame)
  const target =
    props.viewMode === 'overview'
      ? new Vector3(
          0,
          Math.min(room.value.roomHeight - 1.1, room.value.roomHeight * 0.73),
          room.value.rearWallZ - 0.85,
        )
      : new Vector3(selected.value.x, selected.value.eyeY, selected.value.z)
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
  // Full horizontal look-around; tilt is bounded to avoid camera flipping.
  const newYaw = yaw - dx * 0.004
  yaw = Math.atan2(Math.sin(newYaw), Math.cos(newYaw))
  pitch = Math.max(-0.9, Math.min(0.9, pitch - dy * 0.0036))
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
  camera.fov = verticalFovFromHorizontal(props.horizontalFov, camera.aspect)
  camera.updateProjectionMatrix()
  if (props.viewMode === 'overview') orientCamera()
}

// Only recreate a few instanced mesh batches when the physical estimate changes,
// rather than rendering one Three.Mesh per individual seat.
watch(
  () => [props.seats, props.auditorium.seatWidth] as const,
  ([seats, seatWidth]) => {
    const previous = seatInstances.value
    seatInstances.value = createCinemaSeatInstances(seats, seatWidth)
    if (previous) void nextTick(() => disposeCinemaSeatInstances(previous))
  },
  { immediate: true },
)

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
watch(() => props.horizontalFov, resizeCamera)

onMounted(() => {
  mounted = true
  try {
    projectionTexture.value = createCinemaScreenTexture()
  } catch {
    // Retain the plain screen material when Canvas 2D is unavailable.
    projectionTexture.value = null
  }
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
  if (seatInstances.value) disposeCinemaSeatInstances(seatInstances.value)
  projectionTexture.value?.dispose()
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

      <!-- The entire envelope is estimated, not taken from an architectural survey. -->
      <TresMesh :position="[0, -0.25, room.centerZ]" :rotation="[-Math.PI / 2, 0, 0]">
        <TresPlaneGeometry :args="[room.roomWidth, room.roomDepth]" />
        <TresMeshStandardMaterial color="#111725" :roughness="0.99" />
      </TresMesh>
      <TresMesh
        v-for="side in [-1, 1]"
        :key="'wall-' + side"
        :position="[(side * room.roomWidth) / 2, room.roomHeight / 2, room.centerZ]"
      >
        <TresBoxGeometry :args="[0.24, room.roomHeight, room.roomDepth]" />
        <TresMeshStandardMaterial color="#161e2e" :roughness="0.97" />
      </TresMesh>
      <TresMesh :position="[0, room.roomHeight / 2, room.frontWallZ]">
        <TresBoxGeometry :args="[room.roomWidth, room.roomHeight, 0.36]" />
        <TresMeshStandardMaterial color="#080d18" :roughness="1" />
      </TresMesh>
      <TresMesh :position="[0, room.roomHeight / 2, room.rearWallZ]">
        <TresBoxGeometry :args="[room.roomWidth, room.roomHeight, 0.32]" />
        <TresMeshStandardMaterial color="#131a2b" :roughness="0.98" />
      </TresMesh>
      <TresMesh :position="[0, room.roomHeight + 0.1, room.centerZ]">
        <TresBoxGeometry :args="[room.roomWidth, 0.22, room.roomDepth]" />
        <TresMeshStandardMaterial color="#131927" :roughness="0.98" />
      </TresMesh>

      <!-- Dark acoustic cladding and baffles, all presentational estimates. -->
      <TresGroup v-for="(panel, index) in room.acousticPanels" :key="'acoustic-' + index">
        <TresMesh
          v-for="side in [-1, 1]"
          :key="'acoustic-' + side"
          :position="[side * (room.roomWidth / 2 - 0.2), room.roomHeight * 0.5, panel.z]"
        >
          <TresBoxGeometry :args="[0.085, panel.height, Math.min(1.5, room.roomDepth / 8)]" />
          <TresMeshStandardMaterial color="#253047" :roughness="0.97" />
        </TresMesh>
      </TresGroup>
      <TresMesh
        v-for="(baffle, index) in room.ceilingBaffles"
        :key="'ceiling-' + index"
        :position="[0, room.roomHeight - 0.12, baffle.z]"
      >
        <TresBoxGeometry :args="[room.roomWidth - 0.6, 0.24, baffle.depth]" />
        <TresMeshStandardMaterial color="#1d2636" :roughness="0.96" />
      </TresMesh>

      <!-- Screen frame, original procedural image and a shallow projection stage. -->
      <TresMesh :position="[screen.centerX, screen.bottomY + screen.height / 2, screen.z - 0.1]">
        <TresBoxGeometry :args="[screen.width + 0.52, screen.height + 0.52, 0.18]" />
        <TresMeshStandardMaterial color="#0a0d15" :roughness="0.86" />
      </TresMesh>
      <TresMesh :position="[screen.centerX, screen.bottomY + screen.height / 2, screen.z + 0.018]">
        <TresPlaneGeometry :args="[screen.width, screen.height]" />
        <TresMeshBasicMaterial v-if="projectionTexture" :map="projectionTexture" />
        <TresMeshBasicMaterial v-else color="#718ba8" />
      </TresMesh>
      <TresMesh :position="[0, -0.1, screen.z + 1.2]">
        <TresBoxGeometry :args="[Math.min(room.roomWidth - 1, screen.width + 1.8), 0.2, 2.2]" />
        <TresMeshStandardMaterial color="#141c2b" :roughness="0.94" />
      </TresMesh>

      <!-- Raised decks match observed row positions; heights/pitches remain adjustable estimates. -->
      <TresMesh
        v-for="tier in room.tiers"
        :key="'deck-' + tier.row"
        :position="[0, tier.centerY, tier.z]"
      >
        <TresBoxGeometry
          :args="[room.roomWidth - 0.45, tier.height, Math.max(0.22, tier.depth - 0.02)]"
        />
        <TresMeshStandardMaterial color="#242d3d" :roughness="0.97" />
      </TresMesh>
      <TresMesh
        v-for="tier in room.tiers"
        :key="'nosing-' + tier.row"
        :position="[0, tier.elevation + 0.012, tier.frontZ + 0.035]"
      >
        <TresBoxGeometry :args="[room.roomWidth - 1.25, 0.025, 0.07]" />
        <TresMeshStandardMaterial color="#5d6574" :roughness="0.91" />
      </TresMesh>

      <!-- Dark visual seams at observed seat gaps, not an official evacuation plan. -->
      <TresMesh
        v-for="(gap, index) in room.aisleTraces"
        :key="'gap-' + index"
        :position="[gap.x, gap.elevation + 0.025, gap.z]"
      >
        <TresBoxGeometry :args="[gap.width, 0.02, gap.depth]" />
        <TresMeshStandardMaterial color="#121d2b" :roughness="0.96" />
      </TresMesh>

      <!-- Low aisle guide lights, with no implied measured fixture positions. -->
      <TresGroup v-for="tier in room.tiers" :key="'guides-' + tier.row">
        <TresMesh
          v-for="side in [-1, 1]"
          :key="'guide-' + side"
          :position="[side * (room.roomWidth / 2 - 0.46), tier.elevation + 0.043, tier.z]"
        >
          <TresBoxGeometry :args="[0.065, 0.025, Math.max(0.22, tier.depth - 0.1)]" />
          <TresMeshStandardMaterial color="#dfae78" emissive="#c67b3c" :emissive-intensity="0.85" />
        </TresMesh>
      </TresGroup>

      <TresMesh
        v-for="(position, index) in wheelchairSpots ?? []"
        :key="'wheelchair-' + index"
        :position="[position.x, position.elevation + 0.046, position.z]"
        :rotation="[-Math.PI / 2, 0, 0]"
      >
        <TresPlaneGeometry :args="[0.76, 0.76]" />
        <TresMeshStandardMaterial color="#5b8d9b" :roughness="0.91" />
      </TresMesh>
      <primitive v-if="seatInstances" :object="seatInstances" />

      <!-- The selected seat gets a restrained marker in room overview only. -->
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
