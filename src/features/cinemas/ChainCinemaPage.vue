<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'
import { chainCinemas } from './chain-directory'
import {
  publishedHallsForCinema,
  publishedSeatTotal,
  VIESHOW_HALL_SOURCE,
  VIESHOW_HALL_SOURCE_DATE,
} from './vieshow-halls'

const route = useRoute()
const { t } = useI18n()
const cinema = computed(() => chainCinemas.find((venue) => venue.slug === route.params.slug))
const halls = computed(() => publishedHallsForCinema(cinema.value?.slug ?? ''))
const seatTotal = computed(() => publishedSeatTotal(cinema.value?.slug ?? ''))
</script>

<template>
  <section class="container chain-cinema-page">
    <RouterLink to="/" class="back-link">
      <v-icon icon="mdi-chevron-left" size="20" />
      {{ t('chainDetail.back') }}
    </RouterLink>

    <template v-if="cinema">
      <span class="eyebrow">{{ t('chainDetail.eyebrow') }}</span>
      <header class="chain-cinema-page__header">
        <div>
          <h1>{{ cinema.name }}</h1>
          <p><v-icon icon="mdi-map-marker-outline" size="16" /> {{ cinema.address }}</p>
        </div>
        <a
          :href="cinema.sourceUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="chain-cinema-page__source-link"
        >
          {{ t('chainDetail.officialSite') }}
          <v-icon icon="mdi-open-in-new" size="16" />
        </a>
      </header>

      <div v-if="halls.length" class="chain-cinema-page__summary">
        <div>
          <strong>{{ halls.length }}</strong>
          <span>{{ t('chainDetail.publishedHalls') }}</span>
        </div>
        <div>
          <strong>{{ seatTotal.toLocaleString() }}</strong>
          <span>{{ t('chainDetail.publishedSeats') }}</span>
        </div>
      </div>

      <div class="chain-cinema-page__subheading">
        <h2>{{ t('chainDetail.hallList') }}</h2>
        <span v-if="halls.length">{{
          t('chainDetail.countsAsOf', { date: VIESHOW_HALL_SOURCE_DATE })
        }}</span>
      </div>

      <div v-if="halls.length" class="chain-cinema-page__list">
        <article v-for="hall in halls" :key="hall.hallNumber" class="chain-cinema-page__hall">
          <div>
            <strong>{{ t('chainDetail.hallNumber', { number: hall.hallNumber }) }}</strong>
            <small>{{ t('chainDetail.countOnly') }}</small>
          </div>
          <span>{{ t('chainDetail.seats', { count: hall.publishedSeatCount }) }}</span>
        </article>
      </div>

      <p v-else class="chain-cinema-page__empty">
        {{ t('chainDetail.notYetVerified') }}
      </p>

      <div class="chain-cinema-page__provenance">
        <v-icon icon="mdi-information-outline" size="19" />
        <div>
          <p>{{ t('chainDetail.notice') }}</p>
          <a
            v-if="halls.length"
            :href="VIESHOW_HALL_SOURCE"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ t('chainDetail.publishedSource') }}
            <v-icon icon="mdi-open-in-new" size="14" />
          </a>
        </div>
      </div>
    </template>

    <p v-else class="search-empty" role="status">{{ t('chainDetail.notFound') }}</p>
  </section>
</template>
