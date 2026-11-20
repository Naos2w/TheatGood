<script setup lang="ts">
import type { CinemaRoomLayout } from './cinema-room-layout'
import type { CinemaWheelchairSpot } from './cinema-scene-model'

defineProps<{
  room: CinemaRoomLayout
  wheelchairSpots?: CinemaWheelchairSpot[]
}>()
</script>

<template>
  <!-- Room materials and dimensions are illustrative, never architectural measurements. -->
  <TresGroup>
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

    <!-- Seat-grid gaps are NOT a certified evacuation route. -->
    <TresMesh
      v-for="(gap, index) in room.aisleTraces"
      :key="'gap-' + index"
      :position="[gap.x, gap.elevation + 0.025, gap.z]"
    >
      <TresBoxGeometry :args="[gap.width, 0.02, gap.depth]" />
      <TresMeshStandardMaterial color="#121d2b" :roughness="0.96" />
    </TresMesh>
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
  </TresGroup>
</template>
