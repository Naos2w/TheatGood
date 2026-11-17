<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'
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
      </div>
    </div>

    <p v-if="loading" role="status">{{ t('vieshowSeatRefs.loading') }}</p>
    <p v-else-if="failed" role="alert">{{ t('vieshowSeatRefs.failed') }}</p>

    <div v-else class="vieshow-hall-selector">
      <div class="vieshow-hall-selector__grid">
        <RouterLink
          v-for="hall in halls"
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
          <strong>{{ hall.hallLabel }}</strong>
          <span>
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
          <strong>{{ t('chainDetail.hallNumber', { number }) }}</strong>
          <small>{{ t('ux.unavailable') }}</small>
        </div>
      </div>
    </div>
  </section>
</template>
