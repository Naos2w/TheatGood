import { defineStore } from 'pinia'
import { ref } from 'vue'

export type CameraMode = 'overview' | 'seat'

export const useViewerStore = defineStore('viewer', () => {
  const selectedSeatId = ref('E07')
  const cameraMode = ref<CameraMode>('overview')

  function selectSeat(seatId: string) {
    selectedSeatId.value = seatId
    cameraMode.value = 'seat'
  }

  function showOverview() {
    cameraMode.value = 'overview'
  }

  function showSelectedSeat() {
    cameraMode.value = 'seat'
  }

  return { selectedSeatId, cameraMode, selectSeat, showOverview, showSelectedSeat }
})
