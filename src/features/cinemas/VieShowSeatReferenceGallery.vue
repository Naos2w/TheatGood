<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'
import { hallFormatTags } from './hall-format-tags'
import {
  loadVieShowArchiveForCinema,
  vieShowCoverageForCinema,
  type VieShowArchivedLayout,
} from './vieshow-seat-archive'

const props = defineProps<{ cinemaSlug: string }>()
const { t } = useI18n()
const route = useRoute()
const coverage = computed(() => vieShowCoverageForCinema(props.cinemaSlug))
const halls = ref<readonly VieShowArchivedLayout[]>([])
const loading = ref(false)
const failed = ref(false)
const highlighted = computed(() => (typeof route.query.hall === 'string' ? route.query.hall : ''))
// Compute once per hall instead of repeating source checks for every badge.
const hallTiles = computed(() =>
  halls.value.map((hall) => ({ hall, formats: hallFormatTags(props.cinemaSlug, hall) })),
)

watch(
  () => props.cinemaSlug,
  async (slug, _previous, onCleanup) => {
    halls.value = []
    failed.value = false
    loading.value = Boolean(vieShowCoverageForCinema(slug))
    if (!loading.value) return
    let cancelled = false
    onCleanup(() => {
      cancelled = true
    })
    try {
      const items = await loadVieShowArchiveForCinema(slug)
      if (!cancelled) halls.value = items
    } catch {
      if (!cancelled) failed.value = true
    } finally {
      if (!cancelled) loading.value = false
    }
  },
  { immediate: true },
)
</script>

<template>
  <section
    v-if="coverage"
    id="vieshow-seat-references"
    class="seat-references"
    aria-labelledby="vieshow-seat-references-heading"
  >
    <div class="seat-references__heading">
      <div>
        <h2 id="vieshow-seat-references-heading">{{ t('ux.chooseHall') }}</h2>
        <p>{{ t('ux.chooseHallHint') }}</p>
        <small class="vieshow-hall-selector__legend-hint">{{
          t('vieshowSeatRefs.formatEvidenceHint')
        }}</small>
      </div>
    </div>

    <p v-if="loading" role="status">{{ t('vieshowSeatRefs.loading') }}</p>
    <p v-else-if="failed" role="alert">{{ t('vieshowSeatRefs.failed') }}</p>

    <div v-else class="vieshow-hall-selector">
      <div class="vieshow-hall-selector__grid">
        <RouterLink
          v-for="{ hall, formats } in hallTiles"
          :key="hall.id"
          :to="'/cinemas/' + cinemaSlug + '/halls/' + hall.id"
          class="vieshow-hall-selector__tile vieshow-hall-selector__link"
          :class="{
            'vieshow-hall-selector__tile--active':
              highlighted === hall.id ||
              highlighted === String(hall.hallNumber) ||
              highlighted === hall.hallLabel,
          }"
        >
          <span class="vieshow-hall-selector__tile-heading">
            <strong>{{ hall.hallLabel }}</strong>
            <small>{{
              t('vieshowSeatRefs.seatCountShort', { count: hall.ordinarySeatCount })
            }}</small>
          </span>
          <span class="vieshow-hall-selector__format-slot">
            <span v-if="formats.length" class="vieshow-hall-selector__formats">
              <span
                v-for="format in formats"
                :key="format.label"
                class="vieshow-hall-selector__format"
                :class="{
                  'vieshow-hall-selector__format--inferred':
                    format.confidence === 'capacity-cross-reference',
                  'vieshow-hall-selector__format--premium': format.label === 'GOLD CLASS',
                  'vieshow-hall-selector__format--imax': format.label === 'IMAX',
                  'vieshow-hall-selector__format--titan': format.label === 'TITAN',
                }"
                :title="
                  format.confidence === 'capacity-cross-reference'
                    ? t('vieshowSeatRefs.inferredFormatExplanation')
                    : undefined
                "
              >
                {{ format.label }}
                <small v-if="format.confidence === 'capacity-cross-reference'">{{
                  t('vieshowSeatRefs.formatUnverified')
                }}</small>
              </span>
            </span>
            <span v-else class="vieshow-hall-selector__format-default">
              <v-icon icon="mdi-seat-outline" size="14" />
              {{ t('vieshowSeatRefs.mapAvailable') }}
            </span>
          </span>
          <span class="vieshow-hall-selector__tile-action">
            {{ t('ux.chooseSeat') }}
            <v-icon icon="mdi-chevron-right" size="16" />
          </span>
        </RouterLink>
        <div
          v-for="number in coverage.missingOfficialHalls"
          :key="'missing-' + number"
          class="vieshow-hall-selector__tile vieshow-hall-selector__tile--missing"
          :aria-label="t('vieshowSeatRefs.missingHallAria', { number })"
        >
          <span class="vieshow-hall-selector__tile-heading">
            <strong>{{ t('chainDetail.hallNumber', { number }) }}</strong>
          </span>
          <span class="vieshow-hall-selector__format-slot">
            <small>{{ t('vieshowSeatRefs.hallStillMissing') }}</small>
          </span>
          <span class="vieshow-hall-selector__tile-action">
            <v-icon icon="mdi-lock-outline" size="14" />
            {{ t('ux.unavailable') }}
          </span>
        </div>
      </div>
    </div>
  </section>
</template>
