import type { AuditoriumDefinition } from './geometry'

/**
 * Demonstration geometry only: deliberately NOT a surveyed / named Taiwanese cinema.
 * Replace with source-verified data in P0.3 before claiming a real-world seat preview.
 */
export const demoAuditorium: AuditoriumDefinition = {
  modelVersion: 1,
  id: 'demo',
  name: '影廳視角互動展示',
  cinemaName: 'TheatGood 示範影廳',
  format: '1.90:1 畫幅示意',
  description: '這是為了測試操作與視角計算建立的示範模型，不代表任何真實影城。',
  confidence: 'estimated',
  sources: [],
  publishedSeatCount: 114,
  provenance: {
    screenDimensions: 'estimated',
    seatLabels: 'estimated',
    spatialGeometry: 'estimated',
    checkedAt: '2026-11-15',
    notes: '虛構示範影廳：所有尺寸、座位與視角均為估算資料。',
  },
  screen: { width: 17.1, height: 9, centerX: 0, bottomY: 1.4, z: 0 },
  seatWidth: 0.7,
  seatSpacing: 0.89,
  aisleWidth: 0.85,
  eyeHeight: 1.18,
  rows: [
    { label: 'A', numbers: numbers(10), z: 6.0, elevation: 0.05, aislesAfter: [2, 6] },
    { label: 'B', numbers: numbers(12), z: 8.1, elevation: 0.25, aislesAfter: [3, 7] },
    { label: 'C', numbers: numbers(12), z: 10.2, elevation: 0.48, aislesAfter: [3, 7] },
    { label: 'D', numbers: numbers(14), z: 12.3, elevation: 0.72, aislesAfter: [4, 9] },
    { label: 'E', numbers: numbers(14), z: 14.4, elevation: 0.96, aislesAfter: [4, 9] },
    { label: 'F', numbers: numbers(14), z: 16.5, elevation: 1.21, aislesAfter: [4, 9] },
    { label: 'G', numbers: numbers(14), z: 18.6, elevation: 1.48, aislesAfter: [4, 9] },
    { label: 'H', numbers: numbers(12), z: 20.7, elevation: 1.76, aislesAfter: [3, 7] },
    { label: 'I', numbers: numbers(12), z: 22.8, elevation: 2.05, aislesAfter: [3, 7] },
  ],
}

function numbers(count: number): number[] {
  return Array.from({ length: count }, (_, index) => index + 1)
}
