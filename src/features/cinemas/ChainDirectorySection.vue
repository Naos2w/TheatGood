<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import type { GeoPoint } from '../auditoriums/proximity'
import { appLocale } from '../../composables/usePreferences'
import { chainCinemas, type ChainBrand, type ChainCinema } from './chain-directory'
import { chainDistanceKm, sortChainsByDistance } from './chain-positions'
import {
  cinemaHasVerifiedSeatMap,
  searchChainCinemaVenues,
  type CinemaDiscoveryModelFilter,
} from '../home/discovery-categories'
import {
  venueBrandLabel,
  venueBrandVariant,
  venuePrimaryLabel,
  verifiedFormatsForCinema,
  cinemaIdentityAsset,
  type AuditoriumFormatFilter,
} from './cinema-discovery-metadata'
import { cinemaMapUrl, currentMapPlatform, type MapPlatform } from './map-links'

const props = defineProps<{
  query: string
  city: string
  origin: GeoPoint | null
  sortByDistance: boolean
  formatFilter: AuditoriumFormatFilter
  brandFilter: ChainBrand | 'all'
  modelFilter: CinemaDiscoveryModelFilter
}>()
const { t } = useI18n()
const mapPlatform = ref<MapPlatform>('desktop')
onMounted(() => {
  mapPlatform.value = currentMapPlatform()
})
const expanded = ref(false)
watch(
  () => [props.query, props.city, props.formatFilter, props.brandFilter, props.modelFilter],
  () => {
    expanded.value = false
  },
)

const filtered = computed(() =>
  searchChainCinemaVenues(
    props.query,
    props.city,
    props.formatFilter,
    props.brandFilter,
    props.modelFilter,
  ),
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
  return format === 'giant' ? 'TITAN' : format.toUpperCase()
}
</script>

<template>
  <section class="chain-directory" aria-labelledby="chain-directory-heading">
    <div class="chain-directory__heading">
      <h2 id="chain-directory-heading">{{ t('home.chainsTitle') }}</h2>
      <span class="chain-directory__count">{{
        t('home.chainsCount', { count: filtered.length, total: chainCinemas.length })
      }}</span>
      <span v-if="origin" class="chain-directory__nearest-note">{{ t('home.nearestFirst') }}</span>
    </div>
    <p
      v-if="visible.some((cinema) => verifiedFormatsForCinema(cinema.slug).length)"
      class="chain-directory__format-explanation"
    >
      <v-icon icon="mdi-information-outline" size="15" />
      {{ t('home.specialFormatNote') }}
    </p>

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
          :aria-label="
            cinema.name +
            (verifiedFormatsForCinema(cinema.slug).length
              ? '，' +
                t('home.specialFormatsLabel') +
                '：' +
                verifiedFormatsForCinema(cinema.slug).map(formatLabel).join('、')
              : '')
          "
        >
          <span
            class="chain-cinema__symbol chain-cinema__mall-symbol"
            :class="{
              'chain-cinema__mall-symbol--wide': cinemaIdentityAsset(cinema)?.kind === 'wordmark',
            }"
            aria-hidden="true"
          >
            <img
              v-if="cinemaIdentityAsset(cinema)"
              :src="cinemaIdentityAsset(cinema)?.src"
              width="40"
              height="40"
              alt=""
              loading="lazy"
            />
            <v-icon v-else icon="mdi-map-marker-outline" size="23" />
          </span>
          <span class="chain-cinema__details">
            <strong class="chain-cinema__mall">{{ venuePrimaryLabel(cinema) }}</strong>
            <span class="chain-cinema__identity">
              <span
                class="chain-cinema__brand-chip"
                :aria-label="t('home.chainBrand') + '：' + venueBrandLabel(cinema)"
              >
                <img
                  v-if="cinema.brand === 'vieshow'"
                  src="/brands/vieshow-symbol.png"
                  alt=""
                  width="14"
                  height="14"
                />
                {{ venueBrandLabel(cinema) }}
              </span>
              <span class="chain-cinema__city">{{ cinema.city }}</span>
              <span v-if="distanceLabel(cinema)" class="chain-cinema__distance">
                {{ t('home.distanceKm', { distance: distanceLabel(cinema) }) }}
              </span>
            </span>
            <span
              v-if="verifiedFormatsForCinema(cinema.slug).length"
              class="chain-cinema__format-tags"
            >
              <small class="chain-cinema__format-prefix">{{ t('home.specialFormatsLabel') }}</small>
              <span
                v-for="format in verifiedFormatsForCinema(cinema.slug)"
                :key="format"
                class="chain-cinema__format-badge"
                :class="'chain-cinema__format-badge--' + format"
                >{{ formatLabel(format) }}</span
              >
            </span>
            <span
              class="chain-cinema__model-status"
              :class="{
                'chain-cinema__model-status--ready': cinemaHasVerifiedSeatMap(cinema.slug),
              }"
            >
              <v-icon
                :icon="
                  cinemaHasVerifiedSeatMap(cinema.slug)
                    ? 'mdi-check-circle-outline'
                    : 'mdi-information-outline'
                "
                size="14"
              />
              {{
                cinemaHasVerifiedSeatMap(cinema.slug)
                  ? t('home.chainSeatMapReady')
                  : t('home.chainInfoOnly')
              }}
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
