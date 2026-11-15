<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'
import { appLocale } from '../../composables/usePreferences'
import { cinemaDirectory, directoryCinemaName, directoryHallName } from './directory'

const route = useRoute()
const { t } = useI18n()
const hall = computed(() => cinemaDirectory.find((item) => item.slug === String(route.params.slug)))
const countBasisLabel = computed(() => {
  const basis = hall.value?.seatCountBasis
  return basis === 'includes-wheelchair'
    ? t('directory.countIncludes')
    : basis === 'excludes-wheelchair'
      ? t('directory.countExcludes')
      : t('directory.countUnspecified')
})
const verifiedDate = computed(() =>
  hall.value
    ? new Intl.DateTimeFormat(appLocale.value, { dateStyle: 'long', timeZone: 'UTC' }).format(
        new Date(hall.value.checkedAt + 'T00:00:00Z'),
      )
    : '',
)
</script>

<template>
  <section class="container directory-detail">
    <RouterLink to="/" class="back-link">
      <v-icon icon="mdi-chevron-left" size="25" /> {{ t('directory.backToDirectory') }}
    </RouterLink>
    <div v-if="hall" class="directory-detail__content">
      <span class="eyebrow">THEATGOOD / OFFICIAL VENUE DIRECTORY</span>
      <h1>{{ directoryHallName(hall, appLocale) }}</h1>
      <p class="directory-detail__venue">
        {{ directoryCinemaName(hall, appLocale) }} · {{ hall.city }}
      </p>
      <div class="directory-detail__status">
        <v-icon icon="mdi-information-outline" size="21" />
        <div>
          <strong>{{ t('directory.sourceOnly') }}</strong>
          <p>{{ t('directory.unavailable') }}</p>
        </div>
      </div>
      <dl class="directory-detail__facts">
        <div>
          <dt>{{ t('directory.seatTotal') }}</dt>
          <dd>{{ t('home.hallCount', { count: hall.seatCount }) }}</dd>
          <small>{{ countBasisLabel }}</small>
          <small v-if="hall.wheelchairSeats !== undefined">
            {{ t('directory.wheelchair', { count: hall.wheelchairSeats }) }}
          </small>
        </div>
        <div>
          <dt>{{ t('directory.screenSize') }}</dt>
          <dd v-if="hall.screenWidthM && hall.screenHeightM">
            {{ hall.screenWidthM.toFixed(2) }} × {{ hall.screenHeightM.toFixed(2) }} m
          </dd>
          <dd v-else>{{ t('directory.screenUnknown') }}</dd>
        </div>
        <div>
          <dt>{{ t('directory.format') }}</dt>
          <dd>{{ hall.format }}</dd>
        </div>
        <div>
          <dt>{{ t('directory.checked') }}</dt>
          <dd>{{ verifiedDate }}</dd>
        </div>
      </dl>
      <section class="directory-detail__sources">
        <h2>{{ t('directory.sources') }}</h2>
        <a
          v-for="(url, i) in hall.sourceUrls"
          :key="url"
          :href="url"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ t('directory.sources') }} {{ i + 1 }}
          <v-icon icon="mdi-open-in-new" size="16" />
        </a>
      </section>
    </div>
  </section>
</template>
