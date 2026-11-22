<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { DEFAULT_ESTIMATED_SEAT_POV_HORIZONTAL_FOV } from '../cinemas/seat-screen-assumptions'

const props = defineProps<{
  horizontalFov: number
  canMoveFront: boolean
  canMoveBack: boolean
  english: boolean
  selectedSeatId: string
  savedComparisonSeatId: string
}>()
const emit = defineEmits<{
  'update:horizontalFov': [value: number]
  'move-row': [direction: -1 | 1]
  'save-comparison': []
  'swap-comparison': []
  'clear-comparison': []
}>()

const isDefault = computed(() => props.horizontalFov === DEFAULT_ESTIMATED_SEAT_POV_HORIZONTAL_FOV)
const settingsDetails = ref<HTMLDetailsElement | null>(null)

function closeSettings() {
  if (settingsDetails.value) settingsDetails.value.open = false
}
function moveRow(direction: -1 | 1) {
  emit('move-row', direction)
  closeSettings()
}
function saveComparison() {
  emit('save-comparison')
  closeSettings()
}
function switchComparison() {
  emit('swap-comparison')
  closeSettings()
}
watch(() => props.selectedSeatId, closeSettings)

function updateLens(event: Event) {
  const input = event.target
  if (!(input instanceof HTMLInputElement)) return
  const requested = Number(input.value)
  if (!Number.isInteger(requested) || requested < 45 || requested > 95 || requested % 5 !== 0)
    return
  emit('update:horizontalFov', requested)
}
</script>

<template>
  <details ref="settingsDetails" class="cinema-3d-adjustments" @keydown.esc.stop="closeSettings">
    <summary>
      <v-icon icon="mdi-tune-variant" size="17" aria-hidden="true" />
      {{ english ? 'Seat & camera' : '座位／鏡頭' }}
      <span>{{ horizontalFov }}°</span>
      <v-icon
        class="cinema-3d-adjustments__chevron"
        icon="mdi-chevron-down"
        size="17"
        aria-hidden="true"
      />
    </summary>
    <div class="cinema-3d-adjustments__panel">
      <div class="cinema-3d-adjustments__rows">
        <button
          type="button"
          :disabled="!canMoveFront"
          :aria-label="english ? 'Move one row towards the screen' : '往銀幕方向前一排'"
          @click="moveRow(-1)"
        >
          <v-icon icon="mdi-arrow-up" size="17" aria-hidden="true" />
          {{ english ? 'Front row' : '前一排' }}
        </button>
        <button
          type="button"
          :disabled="!canMoveBack"
          :aria-label="english ? 'Move one row away from the screen' : '往後一排'"
          @click="moveRow(1)"
        >
          <v-icon icon="mdi-arrow-down" size="17" aria-hidden="true" />
          {{ english ? 'Back row' : '後一排' }}
        </button>
      </div>
      <label class="cinema-3d-adjustments__lens">
        <span>
          {{ english ? 'Horizontal camera view' : '攝影機水平視角' }}
          <strong>{{ horizontalFov }}°</strong>
        </span>
        <input
          type="range"
          min="45"
          max="95"
          step="5"
          :value="horizontalFov"
          :aria-label="english ? 'Horizontal camera field of view' : '攝影機水平視野角度'"
          @input="updateLens"
        />
      </label>
      <div class="cinema-3d-adjustments__foot">
        <span>{{ english ? 'Narrower' : '窄視野' }}</span>
        <button
          type="button"
          :disabled="isDefault"
          @click="emit('update:horizontalFov', DEFAULT_ESTIMATED_SEAT_POV_HORIZONTAL_FOV)"
        >
          {{ english ? 'Default' : '還原' }} {{ DEFAULT_ESTIMATED_SEAT_POV_HORIZONTAL_FOV }}°
        </button>
        <span>{{ english ? 'Wider' : '廣視野' }}</span>
      </div>
      <div class="cinema-3d-adjustments__compare">
        <div class="cinema-3d-adjustments__compare-heading">
          <v-icon icon="mdi-compare-horizontal" size="17" aria-hidden="true" />
          <strong>{{ english ? 'Compare two seats' : '比較兩個座位' }}</strong>
        </div>
        <p class="cinema-3d-adjustments__compare-status" aria-live="polite">
          {{
            savedComparisonSeatId
              ? (english ? 'Other seat: ' : '已存比較席：') +
                savedComparisonSeatId +
                (english ? ' · Current: ' : ' · 目前：') +
                selectedSeatId
              : english
                ? 'Save this seat, select another and switch between them.'
                : '先儲存目前座位，換到另一席後即可來回比較。'
          }}
        </p>
        <div class="cinema-3d-adjustments__compare-buttons">
          <button
            type="button"
            :disabled="!selectedSeatId"
            :aria-label="english ? 'Save current seat for comparison' : '儲存目前座位作為比較基準'"
            @click="saveComparison"
          >
            {{ english ? 'Save seat' : '儲存此座位' }}
          </button>
          <button
            type="button"
            :disabled="!savedComparisonSeatId || savedComparisonSeatId === selectedSeatId"
            :aria-label="english ? 'Switch between compared seats' : '切換兩個比較座位'"
            @click="switchComparison"
          >
            {{ english ? 'Switch seats' : '切換比較席' }}
          </button>
          <button
            type="button"
            :disabled="!savedComparisonSeatId"
            :aria-label="english ? 'Clear compared seat' : '清除比較座位'"
            @click="emit('clear-comparison')"
          >
            {{ english ? 'Clear' : '清除' }}
          </button>
        </div>
      </div>
      <p>
        {{
          english
            ? 'Camera field of view only, not the measured screen size. Row changes use observed seat positions.'
            : '僅調整觀看鏡頭，不代表銀幕的實際大小；跨排移動依來源座位位置。'
        }}
      </p>
    </div>
  </details>
</template>

<style scoped>
.cinema-3d-adjustments {
  width: 100%;
  max-width: 340px;
  margin-left: auto;
  border: 1px solid rgba(220, 230, 244, 0.19);
  border-radius: 15px;
  background: rgba(22, 33, 48, 0.75);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.17);
  color: #f4f6fa;
  pointer-events: auto;
  -webkit-backdrop-filter: blur(20px);
  backdrop-filter: blur(20px);
}
.cinema-3d-adjustments:not([open]) {
  width: max-content;
  max-width: 100%;
}
.cinema-3d-adjustments[open] {
  display: flex;
  flex-direction: column;
  max-height: calc(100dvh - 145px);
}
.cinema-3d-adjustments summary {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  cursor: pointer;
  padding: 8px 13px;
  min-height: 44px;
  font-size: 12px;
  font-weight: 700;
  list-style: none;
}
.cinema-3d-adjustments summary::-webkit-details-marker {
  display: none;
}
.cinema-3d-adjustments summary span {
  opacity: 0.76;
}
.cinema-3d-adjustments__chevron {
  transition: transform 160ms ease;
}
.cinema-3d-adjustments[open] .cinema-3d-adjustments__chevron {
  transform: rotate(180deg);
}
.cinema-3d-adjustments[open] summary {
  border-bottom: 1px solid rgba(220, 230, 244, 0.16);
}
.cinema-3d-adjustments__panel {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding: 10px 12px 12px;
}
.cinema-3d-adjustments__rows {
  display: flex;
  gap: 8px;
}
.cinema-3d-adjustments__rows button {
  display: inline-flex;
  flex: 1 1 50%;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 42px;
  border: 1px solid rgba(255, 255, 255, 0.17);
  border-radius: 11px;
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
  font-size: 12px;
}
.cinema-3d-adjustments button:disabled {
  opacity: 0.35;
  cursor: default;
}
.cinema-3d-adjustments__lens {
  display: grid;
  gap: 3px;
  margin-top: 12px;
}
.cinema-3d-adjustments__lens span {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
}
.cinema-3d-adjustments__lens input {
  width: 100%;
  min-height: 32px;
  accent-color: #d0a879;
}
.cinema-3d-adjustments__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  color: #d7dce6;
}
.cinema-3d-adjustments__foot button {
  padding: 4px 10px;
  color: #fbf1e5;
  border-radius: 999px;
  border: 1px solid rgba(220, 230, 244, 0.19);
}
.cinema-3d-adjustments__compare {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.17);
}
.cinema-3d-adjustments__compare-heading {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
}
.cinema-3d-adjustments__compare-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 6px;
  margin-top: 8px;
}
.cinema-3d-adjustments__compare-buttons button {
  min-width: 0;
  min-height: 40px;
  padding: 7px 9px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 10px;
  color: #f4f6fa;
  background: rgba(255, 255, 255, 0.09);
  font-size: 11px;
}
.cinema-3d-adjustments__compare-buttons button:focus-visible {
  outline: 2px solid #d0a879;
  outline-offset: 2px;
}
.cinema-3d-adjustments__panel p {
  margin: 8px 0 0;
  color: #c9d1df;
  font-size: 11px;
  line-height: 1.5;
}
@media (max-width: 1023px) {
  .cinema-3d-adjustments {
    margin-right: auto;
  }
  .cinema-3d-adjustments[open] {
    max-height: min(40dvh, 340px);
  }
}
@media (max-height: 540px) {
  .cinema-3d-adjustments[open] {
    max-height: min(66dvh, 315px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .cinema-3d-adjustments__chevron {
    transition: none;
  }
}
@media (prefers-reduced-transparency: reduce) {
  .cinema-3d-adjustments {
    background: #202d41;
    backdrop-filter: none;
  }
}
</style>
