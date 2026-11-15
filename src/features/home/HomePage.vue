<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { auditoriumCatalog } from '../auditoriums/catalog'

const { t } = useI18n()
const search = ref('')
const realAuditoriums = auditoriumCatalog.filter(
  (hall) => hall.provenance.seatLabels === 'official',
)
const results = computed(() => {
  const term = search.value.trim().toLocaleLowerCase()
  if (!term) return realAuditoriums
  return realAuditoriums.filter((hall) =>
    [
      hall.name,
      hall.cinemaName,
      hall.id,
      t('hall.tfaiName'),
      t('hall.tfaiVenue'),
      'taiwan film audiovisual institute tfai small cinema 新北市 new taipei',
    ].some((value) => value.toLocaleLowerCase().includes(term)),
  )
})
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

      <div class="home-discovery">
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

        <div class="list-heading">
          <h2>{{ t('home.available') }}</h2>
          <span>{{ t('home.count', { count: realAuditoriums.length }) }}</span>
        </div>

        <div v-if="results.length" class="auditorium-list">
          <RouterLink
            v-for="hall in results"
            :key="hall.id"
            class="auditorium-item"
            :to="'/auditoriums/' + hall.id"
            :aria-label="t('home.openHall', { name: t('hall.tfaiName') })"
          >
            <span class="auditorium-item__visual" aria-hidden="true">
              <span class="auditorium-item__screen" />
              <span class="auditorium-item__floor" />
            </span>
            <span class="auditorium-item__content">
              <strong>{{ t('hall.tfaiName') }}</strong>
              <span
                >{{ t('hall.tfaiVenue') }} ·
                {{ t('home.hallCount', { count: hall.publishedSeatCount }) }}</span
              >
              <small>{{ t('app.estimated') }}</small>
            </span>
            <v-icon icon="mdi-chevron-right" size="23" class="auditorium-item__chevron" />
          </RouterLink>
        </div>

        <p v-else class="search-empty" role="status">
          {{ t('home.noResults') }}
        </p>
        <p class="discovery-note">
          <v-icon icon="mdi-information-outline" size="16" />
          {{ t('app.officialNote') }}
        </p>
      </div>
    </div>
  </section>
</template>
