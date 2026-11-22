<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'
import { chainCinemas } from './chain-directory'
import { cinemaMapUrl, currentMapPlatform, googleMapsUrl, type MapPlatform } from './map-links'
import VieShowSeatReferenceGallery from './VieShowSeatReferenceGallery.vue'
import ShowtimeResearchHallGallery from './ShowtimeResearchHallGallery.vue'
import MiranewSeatReferenceGallery from './MiranewSeatReferenceGallery.vue'
import OtherChainFactsPanel from './OtherChainFactsPanel.vue'

const route = useRoute()
const { t } = useI18n()
const mapPlatform = ref<MapPlatform>('desktop')
onMounted(() => {
  mapPlatform.value = currentMapPlatform()
})
const cinema = computed(() => chainCinemas.find((venue) => venue.slug === route.params.slug))
const slug = computed(() => cinema.value?.slug ?? '')
</script>

<template>
  <section class="container chain-cinema-page">
    <RouterLink to="/" class="back-link">
      <v-icon icon="mdi-chevron-left" size="20" />
      {{ t('ux.backToCinemas') }}
    </RouterLink>

    <template v-if="cinema">
      <header class="chain-cinema-page__header">
        <div>
          <h1>{{ cinema.name }}</h1>
          <p><v-icon icon="mdi-map-marker-outline" size="16" /> {{ cinema.address }}</p>
        </div>
        <div class="chain-cinema-page__header-actions">
          <a
            class="chain-cinema-page__map-link"
            :href="cinemaMapUrl(cinema, mapPlatform)"
            :target="mapPlatform === 'desktop' ? '_blank' : undefined"
            rel="noopener noreferrer"
          >
            <v-icon icon="mdi-map-marker-outline" size="18" />
            {{ t('ux.openMap') }}
          </a>
          <a
            v-if="mapPlatform !== 'desktop'"
            class="chain-cinema-page__map-fallback"
            :href="googleMapsUrl(cinema)"
            target="_blank"
            rel="noopener noreferrer"
            >Google Maps</a
          >
        </div>
      </header>

      <p
        v-if="cinema.operatingNowVerified === false"
        class="chain-cinema-page__historical-warning"
        role="note"
      >
        <v-icon icon="mdi-calendar-clock-outline" size="20" aria-hidden="true" />
        {{ t('home.chainHistoricalListingNote', { date: cinema.checkedAt }) }}
      </p>

      <VieShowSeatReferenceGallery v-if="cinema.brand === 'vieshow'" :cinema-slug="slug" />

      <template v-else>
        <OtherChainFactsPanel :cinema="cinema" />
        <ShowtimeResearchHallGallery v-if="cinema.brand === 'showtime'" :cinema-slug="slug" />
        <details v-if="cinema.brand === 'miranew'" class="chain-cinema-page__preview-details">
          <summary>{{ t('ux.exploreSeatReferences') }}</summary>
          <MiranewSeatReferenceGallery :cinema-slug="slug" />
        </details>
      </template>
    </template>

    <p v-else class="search-empty" role="status">{{ t('chainDetail.notFound') }}</p>
  </section>
</template>
