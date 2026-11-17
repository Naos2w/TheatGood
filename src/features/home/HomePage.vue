<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { appLocale } from '../../composables/usePreferences'
import ChainDirectorySection from '../cinemas/ChainDirectorySection.vue'
import { chainCinemas } from '../cinemas/chain-directory'
import { cinemaDirectory, directoryCinemaName, directoryHallName } from '../auditoriums/directory'
import {
  culturalCinemaHalls,
  includesCinemaCategory,
  searchCulturalCinemaHalls,
  searchChainCinemaVenues,
  type CinemaDiscoveryCategory,
  type CinemaDiscoveryModelFilter,
} from './discovery-categories'
import { directoryHallRoute } from '../cinemas/hall-navigation'
import { distanceToCinemaKm, sortHallsByDistance, type GeoPoint } from '../auditoriums/proximity'

type LocationStatus = 'idle' | 'loading' | 'ready' | 'denied' | 'unavailable' | 'timeout'

const { t } = useI18n()
const search = ref('')
const cityFilter = ref('all')
const categoryFilter = ref<CinemaDiscoveryCategory>('all')
const modelFilter = ref<CinemaDiscoveryModelFilter>('all')
const showChains = computed(() => includesCinemaCategory(categoryFilter.value, 'chain'))
const showCultural = computed(() => includesCinemaCategory(categoryFilter.value, 'cultural'))
const categoryOptions: { value: CinemaDiscoveryCategory; label: string; icon: string }[] = [
  { value: 'all', label: 'home.categoryAll', icon: 'mdi-view-grid-outline' },
  { value: 'chain', label: 'home.categoryChain', icon: 'mdi-movie-open-outline' },
  { value: 'cultural', label: 'home.categoryCultural', icon: 'mdi-theater' },
]
const sortMode = ref<'models' | 'distance'>('models')
const currentPosition = ref<GeoPoint | null>(null)
const locationStatus = ref<LocationStatus>('idle')
const cities = [
  ...new Set([
    ...culturalCinemaHalls.map((hall) => hall.city),
    ...chainCinemas.map((cinema) => cinema.city),
  ]),
].sort()

const matchingChains = computed(() =>
  searchChainCinemaVenues(search.value, cityFilter.value, modelFilter.value),
)

const results = computed(() => {
  const matches = searchCulturalCinemaHalls(search.value, cityFilter.value, modelFilter.value)
  if (sortMode.value === 'distance' && currentPosition.value) {
    return sortHallsByDistance(matches, currentPosition.value)
  }
  return matches.sort((a, b) => Number(Boolean(b.modelId)) - Number(Boolean(a.modelId)))
})

const locationMessage = computed(() => {
  switch (locationStatus.value) {
    case 'loading':
      return t('home.locationLoading')
    case 'ready':
      return t('home.locationReady')
    case 'denied':
      return t('home.locationDenied')
    case 'timeout':
      return t('home.locationTimeout')
    case 'unavailable':
      return t('home.locationUnavailable')
    default:
      return ''
  }
})

function locate() {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    locationStatus.value = 'unavailable'
    return
  }
  locationStatus.value = 'loading'
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      currentPosition.value = { latitude: coords.latitude, longitude: coords.longitude }
      sortMode.value = 'distance'
      locationStatus.value = 'ready'
    },
    (error) => {
      currentPosition.value = null
      sortMode.value = 'models'
      locationStatus.value =
        error.code === 1 ? 'denied' : error.code === 3 ? 'timeout' : 'unavailable'
    },
    { enableHighAccuracy: false, maximumAge: 60_000, timeout: 12_000 },
  )
}

function formattedDistance(hall: (typeof cinemaDirectory)[number]): string | undefined {
  if (!currentPosition.value) return undefined
  const distance = distanceToCinemaKm(hall, currentPosition.value)
  return distance === undefined
    ? undefined
    : new Intl.NumberFormat(appLocale.value, {
        maximumFractionDigits: 1,
        minimumFractionDigits: 1,
      }).format(distance)
}
</script>

<template>
  <section class="container home-page">
    <div class="home-layout">
      <div class="home-intro">
        <div class="home-intro__curve" aria-hidden="true" />
        <span class="eyebrow">{{ t('home.eyebrow') }}</span>
        <h1>{{ t('home.headline') }}</h1>
        <p>{{ t('home.subhead') }}</p>
      </div>

      <div id="cinema-discovery" class="home-discovery">
        <label class="search-field">
          <v-icon icon="mdi-magnify" size="24" />
          <input
            v-model="search"
            type="search"
            autocomplete="off"
            :placeholder="t('home.search')"
            :aria-label="t('home.searchAria')"
          />
          <button
            v-if="search"
            class="search-field__clear"
            type="button"
            :aria-label="t('home.clearSearch')"
            @click="search = ''"
          >
            <v-icon icon="mdi-close-circle" size="20" />
          </button>
        </label>

        <div class="discovery-categories" role="group" :aria-label="t('home.categoryLabel')">
          <button
            v-for="category in categoryOptions"
            :key="category.value"
            type="button"
            :class="{ 'discovery-categories__active': categoryFilter === category.value }"
            :aria-pressed="categoryFilter === category.value"
            @click="categoryFilter = category.value"
          >
            <v-icon :icon="category.icon" size="18" />
            {{ t(category.label) }}
          </button>
        </div>
        <div class="discovery-filters">
          <label class="discovery-filter">
            <span>{{ t('home.cityFilter') }}</span>
            <select v-model="cityFilter">
              <option value="all">{{ t('home.allCities') }}</option>
              <option v-for="city in cities" :key="city" :value="city">{{ city }}</option>
            </select>
          </label>
          <label class="discovery-filter">
            <span>{{ t('home.modelFilter') }}</span>
            <select v-model="modelFilter">
              <option value="all">{{ t('home.allModels') }}</option>
              <option value="3d">{{ t('home.only3d') }}</option>
              <option value="information">{{ t('home.onlyInformation') }}</option>
            </select>
          </label>
        </div>

        <details class="discovery-more">
          <summary><v-icon icon="mdi-tune-variant" size="18" />{{ t('ux.moreFilters') }}</summary>
          <div class="discovery-more__body">
            <label class="discovery-filter">
              <span>{{ t('home.sortLabel') }}</span>
              <select v-model="sortMode">
                <option value="models">{{ t('home.sortModels') }}</option>
                <option value="distance" :disabled="!currentPosition">
                  {{ t('home.sortNearest') }}
                </option>
              </select>
            </label>
            <button
              class="discovery-locate"
              type="button"
              :disabled="locationStatus === 'loading'"
              @click="locate"
            >
              <v-icon icon="mdi-crosshairs-gps" size="18" />
              {{ locationStatus === 'ready' ? t('home.refreshLocation') : t('home.findNearby') }}
            </button>
            <p v-if="locationMessage" class="discovery-location-status" role="status">
              {{ locationMessage }}
            </p>
          </div>
        </details>
        <ChainDirectorySection
          v-if="showChains"
          :hide-when-empty="categoryFilter === 'all'"
          :query="search"
          :city="cityFilter"
          :origin="currentPosition"
          :sort-by-distance="sortMode === 'distance'"
          :model-filter="modelFilter"
        />

        <template v-if="showCultural && (categoryFilter === 'cultural' || results.length)">
          <div v-if="results.length">
            <div class="list-heading">
              <h2>{{ t('home.discoveryTitle') }}</h2>
            </div>
            <div class="auditorium-list">
              <RouterLink
                v-for="hall in results"
                :key="hall.slug"
                class="auditorium-item"
                :class="{ 'auditorium-item--catalogue': !hall.modelId }"
                :to="directoryHallRoute(hall)"
                :aria-label="
                  hall.modelId
                    ? t('home.openHall', { name: directoryHallName(hall, appLocale) })
                    : t('home.viewDetails', { name: directoryHallName(hall, appLocale) })
                "
              >
                <span
                  class="auditorium-item__visual"
                  :class="{ 'auditorium-item__visual--catalogue': !hall.modelId }"
                  aria-hidden="true"
                >
                  <template v-if="hall.modelId">
                    <span class="auditorium-item__screen" />
                    <span class="auditorium-item__floor" />
                  </template>
                  <v-icon v-else icon="mdi-theater" size="31" />
                </span>
                <span class="auditorium-item__content">
                  <strong>{{ directoryHallName(hall, appLocale) }}</strong>
                  <span> {{ directoryCinemaName(hall, appLocale) }} · {{ hall.city }} </span>
                  <span v-if="formattedDistance(hall)" class="auditorium-item__distance">
                    {{ t('home.distanceKm', { distance: formattedDistance(hall) }) }}
                  </span>
                  <small>{{
                    hall.modelId === 'vieshow-hsinyi-12'
                      ? t('home.currentHallInsteadOfFestival')
                      : hall.modelId
                        ? t('ux.previewReady')
                        : t('ux.unavailable')
                  }}</small>
                </span>
                <v-icon icon="mdi-chevron-right" size="23" class="auditorium-item__chevron" />
              </RouterLink>
            </div>
          </div>

          <p v-else class="search-empty" role="status">
            {{ t('home.noResults') }}
          </p>
        </template>
        <p
          v-if="categoryFilter === 'all' && !matchingChains.length && !results.length"
          class="search-empty"
          role="status"
        >
          {{ t('home.noResults') }}
        </p>
      </div>
    </div>
  </section>
</template>
