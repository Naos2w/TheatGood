import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useViewerStore = defineStore('viewer', () => {
  const selectedSeatId = ref('E07')

  function selectSeat(seatId: string) {
    selectedSeatId.value = seatId
  }

  return { selectedSeatId, selectSeat }
})
