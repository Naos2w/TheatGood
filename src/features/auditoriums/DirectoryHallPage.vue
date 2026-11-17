<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'
import { appLocale } from '../../composables/usePreferences'
import { cinemaDirectory, directoryCinemaName, directoryHallName } from './directory'

const route = useRoute()
const { t } = useI18n()
const hall = computed(() => cinemaDirectory.find((item) => item.slug === String(route.params.slug)))
</script>

<template>
  <section class="container directory-detail">
    <RouterLink to="/" class="back-link">
      <v-icon icon="mdi-chevron-left" size="20" /> {{ t('ux.backToCinemas') }}
    </RouterLink>
    <div v-if="hall" class="directory-detail__content">
      <h1>{{ directoryHallName(hall, appLocale) }}</h1>
      <p class="directory-detail__venue">
        {{ directoryCinemaName(hall, appLocale) }} · {{ hall.city }}
      </p>
      <div class="directory-detail__status">
        <v-icon icon="mdi-movie-open-outline" size="28" />
        <div>
          <strong>{{ t('ux.moreCinemasSoon') }}</strong>
          <p>{{ t('ux.moreCinemasSoonDetail') }}</p>
        </div>
      </div>
      <RouterLink to="/" class="back-link">{{ t('ux.backToCinemas') }}</RouterLink>
    </div>
    <p v-else class="search-empty">{{ t('home.noResults') }}</p>
  </section>
</template>
