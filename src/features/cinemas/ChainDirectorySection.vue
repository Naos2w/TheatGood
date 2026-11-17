<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import type { GeoPoint } from '../auditoriums/proximity'
import { appLocale } from '../../composables/usePreferences'
import type { ChainCinema } from './chain-directory'
import { chainDistanceKm, sortChainsByDistance } from './chain-positions'
import { searchChainCinemaVenues } from '../home/discovery-categories'
import {
  venueBrandLabel,
  venueBrandVariant,
  venuePrimaryLabel,
  verifiedFormatsForCinema,
  type AuditoriumFormatFilter,
} from './cinema-discovery-metadata'
import { cinemaMapUrl, currentMapPlatform, type MapPlatform } from './map-links'

const props = defineProps<{
  query: string
  city: string
  origin: GeoPoint | null
  sortByDistance: boolean
  formatFilter: AuditoriumFormatFilter
}>()
const { t } = useI18n()
const mapPlatform = ref<MapPlatform>('desktop')
onMounted(() => {
  mapPlatform.value = currentMapPlatform()
})
const expanded = ref(false)

const filtered = computed(() =>
  searchChainCinemaVenues(props.query, props.city, props.formatFilter),
)
const ordered = computed(() =>
  props.sortByDistance && props.origin
    ? sortChainsByDistance(filtered.value, props.origin)
    : filtered.value,
)
const visible = computed(() => (expanded.value ? ordered.value : ordered.value.slice(0, 8)))
const moreAvailable = computed(() => filtered.value.length > 8)

function distanceLabel(cinema: ChainCinema): string | undefined {
  if (!props.origin) return undefined
  const distance = chainDistanceKm(cinema, props.origin)
  return distance === undefined
    ? undefined
    : new Intl.NumberFormat(appLocale.value, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(distance)
}

function formatLabel(format: string): string {
  return format === 'giant' ? t('home.giantScreen') : format.toUpperCase()
}

function brandInitials(cinema: ChainCinema): string {
  switch (cinema.brand) {
    case 'vieshow':
      return 'VS'
    case 'showtime':
      return 'ST'
    case 'miramar':
      return 'MM'
    case 'miranew':
      return 'MN'
  }
}
</script>

<template>
  <section class="chain-directory" aria-labelledby="chain-directory-heading">
    <div class="chain-directory__heading">
      <h2 id="chain-directory-heading">{{ t('home.chainsTitle') }}</h2>
      <span v-if="origin" class="chain-directory__nearest-note">{{ t('home.nearestFirst') }}</span>
    </div>

    <div v-if="visible.length" class="chain-directory__list">
      <article
        v-for="cinema in visible"
        :key="cinema.slug"
        class="chain-cinema chain-cinema--mall-first"
        :class="'chain-cinema--' + venueBrandVariant(cinema)"
      >
        <RouterLink
          class="chain-cinema__whole"
          :to="'/cinemas/' + cinema.slug"
          :aria-label="cinema.name"
        >
          <span class="chain-cinema__symbol chain-cinema__brand-symbol" aria-hidden="true">
            <img
              v-if="cinema.brand === 'vieshow'"
              src="/brands/vieshow.ico"
              width="32"
              height="32"
              alt=""
              loading="lazy"
            />
            <span v-else>{{ brandInitials(cinema) }}</span>
          </span>
          <span class="chain-cinema__details">
            <strong class="chain-cinema__mall">{{ venuePrimaryLabel(cinema) }}</strong>
            <span class="chain-cinema__identity">
              <span class="chain-cinema__brand-chip">{{ venueBrandLabel(cinema) }}</span>
              <span class="chain-cinema__city">{{ cinema.city }}</span>
              <span v-if="distanceLabel(cinema)" class="chain-cinema__distance">
                {{ t('home.distanceKm', { distance: distanceLabel(cinema) }) }}
              </span>
            </span>
            <span
              v-if="verifiedFormatsForCinema(cinema.slug).length"
              class="chain-cinema__format-tags"
            >
              <span v-for="format in verifiedFormatsForCinema(cinema.slug)" :key="format">{{
                formatLabel(format)
              }}</span>
            </span>
          </span>
          <v-icon icon="mdi-chevron-right" size="20" class="chain-cinema__chevron" />
        </RouterLink>
        <a
          :href="cinemaMapUrl(cinema, mapPlatform)"
          :aria-label="t('home.chainMapAria', { name: cinema.name })"
          :target="mapPlatform === 'desktop' ? '_blank' : undefined"
          rel="noopener noreferrer"
          class="chain-cinema__link chain-cinema__link--map"
        >
          <v-icon icon="mdi-map-marker-outline" size="20" />
        </a>
      </article>
    </div>
    <p v-else class="search-empty" role="status">{{ t('home.chainNoResults') }}</p>

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
