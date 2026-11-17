<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import ChainDirectorySection from '../cinemas/ChainDirectorySection.vue'
import type { GeoPoint } from '../auditoriums/proximity'
import type { AuditoriumFormatFilter } from '../cinemas/cinema-discovery-metadata'
import { searchChainCinemaVenues } from './discovery-categories'

type LocationStatus = 'idle' | 'loading' | 'ready' | 'denied' | 'unavailable' | 'timeout'

const { t } = useI18n()
const search = ref('')
const cityFilter = ref('all')
const formatFilter = ref<AuditoriumFormatFilter>('all')
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
        </div>

        <ChainDirectorySection
          :query="search"
          :city="cityFilter"
          :origin="currentPosition"
          :sort-by-distance="Boolean(currentPosition)"
          :format-filter="formatFilter"
        />
      </div>
    </div>
  </section>
</template>
