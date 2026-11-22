<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import ChainDirectorySection from '../cinemas/ChainDirectorySection.vue'
import type { GeoPoint } from '../auditoriums/proximity'
import type { AuditoriumFormatFilter } from '../cinemas/cinema-discovery-metadata'
import { chainCinemas, type ChainBrand } from '../cinemas/chain-directory'
import { searchChainCinemaVenues, type CinemaDiscoveryModelFilter } from './discovery-categories'

type LocationStatus = 'idle' | 'loading' | 'ready' | 'denied' | 'unavailable' | 'timeout'

const { t, locale } = useI18n()
const search = ref('')
const cityFilter = ref('all')
const formatFilter = ref<AuditoriumFormatFilter>('all')
const brandFilter = ref<ChainBrand | 'all'>('all')
const modelFilter = ref<CinemaDiscoveryModelFilter>('all')
const chainBrands: { value: ChainBrand | 'all'; key: string; count: number }[] = [
  { value: 'all', key: 'home.chainAll', count: chainCinemas.length },
  {
    value: 'vieshow',
    key: 'home.chainVieshow',
    count: chainCinemas.filter((cinema) => cinema.brand === 'vieshow').length,
  },
  {
    value: 'showtime',
    key: 'home.chainShowtime',
    count: chainCinemas.filter((cinema) => cinema.brand === 'showtime').length,
  },
  {
    value: 'miramar',
    key: 'home.chainMiramar',
    count: chainCinemas.filter((cinema) => cinema.brand === 'miramar').length,
  },
  {
    value: 'miranew',
    key: 'home.chainMiranew',
    count: chainCinemas.filter((cinema) => cinema.brand === 'miranew').length,
  },
]
const currentPosition = ref<GeoPoint | null>(null)
const locationStatus = ref<LocationStatus>('idle')
const cities = [
  ...new Set(searchChainCinemaVenues('', 'all', 'all').map((cinema) => cinema.city)),
].sort()

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
      cityFilter.value = 'all'
      locationStatus.value = 'ready'
    },
    (error) => {
      currentPosition.value = null
      locationStatus.value =
        error.code === 1 ? 'denied' : error.code === 3 ? 'timeout' : 'unavailable'
    },
    { enableHighAccuracy: false, maximumAge: 60_000, timeout: 12_000 },
  )
}
</script>

<template>
  <section class="container home-page">
    <div class="home-layout">
      <div class="home-intro">
        <h1>{{ t('home.headline') }}</h1>
        <p>{{ t('home.subhead') }}</p>
        <RouterLink to="/3d" class="home-3d-entry">
          <v-icon icon="mdi-cube-scan" size="21" aria-hidden="true" />
          <span>{{
            locale.startsWith('en') ? 'Explore sourced 3D seat views' : '探索有座圖的 3D 影廳'
          }}</span>
          <v-icon icon="mdi-chevron-right" size="20" aria-hidden="true" />
        </RouterLink>
      </div>

      <div id="cinema-discovery" class="home-discovery">
        <div class="home-search-location">
          <label class="search-field">
            <v-icon icon="mdi-magnify" size="23" />
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
          <button
            class="home-nearby glass-control"
            type="button"
            :disabled="locationStatus === 'loading'"
            :aria-busy="locationStatus === 'loading'"
            @click="locate"
          >
            <v-icon
              :icon="
                locationStatus === 'ready' ? 'mdi-crosshairs-gps' : 'mdi-map-marker-radius-outline'
              "
              size="21"
            />
            <span>{{
              locationStatus === 'ready' ? t('home.sortNearest') : t('home.findNearby')
            }}</span>
          </button>
        </div>
        <p v-if="locationMessage" class="home-location-status" role="status">
          {{ locationMessage }}
        </p>

        <div class="discovery-filters">
          <label class="discovery-filter">
            <span>{{ t('home.cityFilter') }}</span>
            <select v-model="cityFilter">
              <option value="all">{{ t('home.allCities') }}</option>
              <option v-for="city in cities" :key="city" :value="city">{{ city }}</option>
            </select>
          </label>
          <label class="discovery-filter">
            <span>{{ t('home.hallFormatFilter') }}</span>
            <select v-model="formatFilter">
              <option value="all">{{ t('home.allHallFormats') }}</option>
              <option value="imax">IMAX</option>
              <option value="giant">{{ t('home.giantScreen') }}</option>
              <option value="4dx">4DX</option>
            </select>
          </label>
          <label class="discovery-filter discovery-filter--availability">
            <span>{{ t('home.modelFilter') }}</span>
            <select v-model="modelFilter">
              <option value="all">{{ t('home.allModels') }}</option>
              <option value="3d">{{ t('home.only3d') }}</option>
              <option value="information">{{ t('home.onlyInformation') }}</option>
            </select>
          </label>
        </div>

        <div class="home-brand-switch" role="group" :aria-label="t('home.chainBrand')">
          <button
            v-for="brand in chainBrands"
            :key="brand.value"
            type="button"
            :class="{ 'is-active': brandFilter === brand.value }"
            :aria-pressed="brandFilter === brand.value"
            @click="brandFilter = brand.value"
          >
            {{ t(brand.key) }}
            <span class="home-brand-switch__count">{{ brand.count }}</span>
          </button>
        </div>

        <ChainDirectorySection
          :query="search"
          :city="cityFilter"
          :origin="currentPosition"
          :sort-by-distance="Boolean(currentPosition)"
          :format-filter="formatFilter"
          :brand-filter="brandFilter"
          :model-filter="modelFilter"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.home-3d-entry {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  max-width: 100%;
  min-height: 44px;
  margin-top: 18px;
  padding: 10px 16px;
  border: 1px solid rgba(var(--v-theme-primary), 0.33);
  border-radius: 14px;
  background: rgba(var(--v-theme-primary), 0.11);
  color: rgb(var(--v-theme-primary));
  font-weight: 700;
  font-size: 14px;
  text-decoration: none;
}
.home-3d-entry:hover,
.home-3d-entry:focus-visible {
  outline: 2px solid rgba(var(--v-theme-primary), 0.6);
  outline-offset: 2px;
}
.home-3d-entry .v-icon:first-child {
  flex: 0 0 auto;
}
</style>
