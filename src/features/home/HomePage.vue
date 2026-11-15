<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { appLocale } from '../../composables/usePreferences'
import {
  cinemaDirectory,
  directoryCinemaName,
  directoryHallName,
  searchCinemaDirectory,
} from '../auditoriums/directory'

const { t } = useI18n()
const search = ref('')
const results = computed(() => searchCinemaDirectory(search.value))
const modelled = computed(() => results.value.filter((hall) => hall.modelId))
const directoryOnly = computed(() => results.value.filter((hall) => !hall.modelId))
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

        <p class="discovery-note discovery-note--summary">
          {{ t('home.count', { count: cinemaDirectory.length }) }}
        </p>

        <div v-if="modelled.length">
          <div class="list-heading">
            <h2>{{ t('home.available') }}</h2>
            <span>{{ t('home.modelledCount', { count: modelled.length }) }}</span>
          </div>
          <div class="auditorium-list">
            <RouterLink
              v-for="hall in modelled"
              :key="hall.slug"
              class="auditorium-item"
              :to="'/auditoriums/' + hall.modelId"
              :aria-label="t('home.openHall', { name: directoryHallName(hall, appLocale) })"
            >
              <span class="auditorium-item__visual" aria-hidden="true">
                <span class="auditorium-item__screen" />
                <span class="auditorium-item__floor" />
              </span>
              <span class="auditorium-item__content">
                <strong>{{ directoryHallName(hall, appLocale) }}</strong>
                <span>
                  {{ directoryCinemaName(hall, appLocale) }} ·
                  {{ t('home.hallCount', { count: hall.seatCount }) }}
                </span>
                <small>{{ t('app.estimated') }}</small>
              </span>
              <v-icon icon="mdi-chevron-right" size="23" class="auditorium-item__chevron" />
            </RouterLink>
          </div>
        </div>

        <div v-if="directoryOnly.length">
          <div class="list-heading">
            <h2>{{ t('home.directoryOnly') }}</h2>
            <span>{{ t('home.directoryCount', { count: directoryOnly.length }) }}</span>
          </div>
          <div class="auditorium-list">
            <RouterLink
              v-for="hall in directoryOnly"
              :key="hall.slug"
              class="auditorium-item auditorium-item--catalogue"
              :to="'/directory/' + hall.slug"
              :aria-label="t('home.viewDetails', { name: directoryHallName(hall, appLocale) })"
            >
              <span
                class="auditorium-item__visual auditorium-item__visual--catalogue"
                aria-hidden="true"
              >
                <v-icon icon="mdi-theater" size="31" />
              </span>
              <span class="auditorium-item__content">
                <strong>{{ directoryHallName(hall, appLocale) }}</strong>
                <span>
                  {{ directoryCinemaName(hall, appLocale) }} · {{ hall.city }} ·
                  {{ t('home.hallCount', { count: hall.seatCount }) }}
                </span>
                <small>{{ t('home.no3dYet') }}</small>
              </span>
              <v-icon icon="mdi-chevron-right" size="23" class="auditorium-item__chevron" />
            </RouterLink>
          </div>
        </div>

        <p v-if="!results.length" class="search-empty" role="status">
          {{ t('home.noResults') }}
        </p>
        <p class="discovery-note">
          <v-icon icon="mdi-information-outline" size="16" />
          {{ t('home.provenanceHint') }}
        </p>
      </div>
    </div>
  </section>
</template>
