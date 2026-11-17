<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import type { GeoPoint } from '../auditoriums/proximity'
import { appLocale } from '../../composables/usePreferences'
import type { ChainBrand, ChainCinema } from './chain-directory'
import { chainDistanceKm, sortChainsByDistance } from './chain-positions'
import { vieShowCoverageForCinema } from './vieshow-seat-archive'
import { searchChainCinemaVenues } from '../home/discovery-categories'
import { cinemaMapUrl, currentMapPlatform, type MapPlatform } from './map-links'

const props = defineProps<{
  query: string
  city: string
  origin: GeoPoint | null
  sortByDistance: boolean
  modelFilter: 'all' | '3d' | 'information'
  hideWhenEmpty?: boolean
}>()
const { t } = useI18n()
const mapPlatform = ref<MapPlatform>('desktop')
onMounted(() => {
  mapPlatform.value = currentMapPlatform()
})
const selectedBrand = ref<ChainBrand | 'all'>('all')
const expanded = ref(false)
const brandNames = [
  { value: 'all', label: 'home.chainAll' },
  { value: 'vieshow', label: 'home.chainVieshow' },
  { value: 'showtime', label: 'home.chainShowtime' },
  { value: 'miramar', label: 'home.chainMiramar' },
  { value: 'miranew', label: 'home.chainMiranew' },
] as const

const sourceLayoutCount = (cinema: ChainCinema): number =>
  vieShowCoverageForCinema(cinema.slug)?.observedLabels ?? 0
const filtered = computed(() =>
  searchChainCinemaVenues(props.query, props.city, props.modelFilter, selectedBrand.value),
)
const ordered = computed(() =>
  props.sortByDistance && props.origin
    ? sortChainsByDistance(filtered.value, props.origin)
    : filtered.value,
)
const visible = computed(() => (expanded.value ? ordered.value : ordered.value.slice(0, 8)))
const moreAvailable = computed(() => filtered.value.length > 8)

function formattedDistance(cinema: ChainCinema): string | undefined {
  if (!props.origin) return undefined
  const distance = chainDistanceKm(cinema, props.origin)
  return distance === undefined
    ? undefined
    : new Intl.NumberFormat(appLocale.value, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(distance)
}
</script>

<template>
  <section
    v-if="!hideWhenEmpty || filtered.length || selectedBrand !== 'all'"
    class="chain-directory"
    aria-labelledby="chain-directory-heading"
  >
    <div class="chain-directory__heading">
      <div>
        <h2 id="chain-directory-heading">{{ t('home.chainsTitle') }}</h2>
      </div>
    </div>

    <label class="chain-directory__brand">
      <span>{{ t('home.chainBrand') }}</span>
      <select v-model="selectedBrand">
        <option v-for="brand in brandNames" :key="brand.value" :value="brand.value">
          {{ t(brand.label) }}
        </option>
      </select>
    </label>

    <div v-if="visible.length" class="chain-directory__list">
      <article v-for="cinema in visible" :key="cinema.slug" class="chain-cinema">
        <span class="chain-cinema__symbol" aria-hidden="true">
          <v-icon icon="mdi-movie-open-outline" size="22" />
        </span>
        <div class="chain-cinema__details">
          <RouterLink class="chain-cinema__name" :to="'/cinemas/' + cinema.slug">
            {{ cinema.name }}
            <v-icon icon="mdi-chevron-right" size="16" />
          </RouterLink>
          <span>{{ cinema.city }} · {{ cinema.address }}</span>
          <span v-if="formattedDistance(cinema)" class="chain-cinema__distance">
            {{ t('home.distanceKm', { distance: formattedDistance(cinema) }) }}
          </span>
          <small v-else-if="origin && sortByDistance">{{
            t('home.chainLocationUnverified')
          }}</small>
          <small class="chain-cinema__preview-count">
            {{ sourceLayoutCount(cinema) ? t('ux.previewReady') : t('ux.unavailable') }}
          </small>
        </div>
        <div class="chain-cinema__actions">
          <RouterLink class="chain-cinema__choose" :to="'/cinemas/' + cinema.slug">
            {{ sourceLayoutCount(cinema) ? t('home.chooseHall') : t('home.viewCinema') }}
            <v-icon icon="mdi-chevron-right" size="17" />
          </RouterLink>
          <a
            :href="cinemaMapUrl(cinema, mapPlatform)"
            :aria-label="t('home.chainMapAria', { name: cinema.name })"
            :target="mapPlatform === 'desktop' ? '_blank' : undefined"
            rel="noopener noreferrer"
            class="chain-cinema__link chain-cinema__link--map"
          >
            <v-icon icon="mdi-map-marker-outline" size="18" />
          </a>
        </div>
      </article>
    </div>
    <p v-else class="search-empty">{{ t('home.chainNoResults') }}</p>

    <button
      v-if="moreAvailable"
      class="chain-directory__more"
      type="button"
      :aria-expanded="expanded"
      @click="expanded = !expanded"
    >
      {{ expanded ? t('home.chainLess') : t('home.chainMore', { count: filtered.length - 8 }) }}
      <v-icon :icon="expanded ? 'mdi-chevron-up' : 'mdi-chevron-down'" size="18" />
    </button>
  </section>
</template>
