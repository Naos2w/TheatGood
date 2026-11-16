<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import type { PublicScreening } from '../../../api/screenings'
import { appLocale } from '../../composables/usePreferences'
import { cinemaDirectory, type DirectoryHall } from '../auditoriums/directory'
import OfficialShowtimesSection from '../cinemas/OfficialShowtimesSection.vue'

const { t } = useI18n()
const screenings = ref<PublicScreening[]>([])
const loadedAt = ref('')
const loading = ref(true)
const error = ref(false)
const query = ref('')
const cinema = ref('all')
const date = ref('')
const upcomingOnly = ref(true)
let request: AbortController | undefined

const venues = computed(() =>
  [...new Map(cinemaDirectory.map((hall) => [hall.cinemaSlug, hall.cinemaName])).entries()].filter(
    ([slug]) => screenings.value.some((screening) => screening.cinemaSlug === slug),
  ),
)

const filtered = computed(() =>
  screenings.value.filter((screening) => {
    if (upcomingOnly.value && Date.parse(screening.startsAt) < Date.now()) return false
    if (cinema.value !== 'all' && screening.cinemaSlug !== cinema.value) return false
    if (date.value && taipeiDate(screening.startsAt) !== date.value) return false
    const term = query.value.trim().toLocaleLowerCase()
    if (!term) return true
    return [screening.movieTitle, screening.publishedHallLabel, cinemaName(screening)].some(
      (value) => value.toLocaleLowerCase().includes(term),
    )
  }),
)

function taipeiDate(utc: string): string {
  // Taiwan is UTC+08:00 year-round. ISO is stable for a native date input,
  // unlike Intl's locale-dependent date ordering.
  return new Date(Date.parse(utc) + 8 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function displayDate(utc: string): string {
  return new Intl.DateTimeFormat(appLocale.value, {
    timeZone: 'Asia/Taipei',
    month: 'short',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(utc))
}

function matchingHall(item: PublicScreening): DirectoryHall | undefined {
  return cinemaDirectory.find(
    (hall) => hall.cinemaSlug === item.cinemaSlug && hall.slug === item.auditoriumSlug,
  )
}

function cinemaName(item: PublicScreening): string {
  const hall = cinemaDirectory.find((entry) => entry.cinemaSlug === item.cinemaSlug)
  return appLocale.value === 'en-GB'
    ? (hall?.cinemaNameEn ?? hall?.cinemaName ?? item.cinemaSlug)
    : (hall?.cinemaName ?? item.cinemaSlug)
}

async function reload() {
  request?.abort()
  const controller = new AbortController()
  request = controller
  loading.value = true
  error.value = false
  try {
    const result = await fetch('/api/screenings', { signal: controller.signal })
    if (!result.ok) throw new Error('source unavailable')
    const data: { screenings?: PublicScreening[]; fetchedAt?: string } = await result.json()
    if (!Array.isArray(data.screenings)) throw new Error('invalid response')
    if (controller.signal.aborted) return
    screenings.value = data.screenings
    loadedAt.value = data.fetchedAt ?? ''
  } catch {
    if (controller.signal.aborted) return
    error.value = true
  } finally {
    if (!controller.signal.aborted) loading.value = false
  }
}

onMounted(reload)
onUnmounted(() => request?.abort())
</script>

<template>
  <section class="container screenings-page">
    <span class="eyebrow">{{ t('screenings.eyebrow') }}</span>
    <header class="screenings-page__heading">
      <div>
        <h1>{{ t('screenings.title') }}</h1>
        <p>{{ t('screenings.subtitle') }}</p>
      </div>
    </header>

    <OfficialShowtimesSection />

    <section class="public-showtimes" aria-labelledby="public-showtimes-heading">
      <div class="public-showtimes__heading">
        <div>
          <h2 id="public-showtimes-heading">{{ t('screenings.publicTitle') }}</h2>
          <p>{{ t('screenings.publicDescription') }}</p>
        </div>
        <button class="screenings-refresh" type="button" :disabled="loading" @click="reload">
          <v-icon icon="mdi-refresh" size="18" />
          {{ t('screenings.refresh') }}
        </button>
      </div>

      <div class="screenings-filters">
        <label>
          <span>{{ t('screenings.searchLabel') }}</span>
          <input v-model="query" type="search" :placeholder="t('screenings.searchPlaceholder')" />
        </label>
        <label>
          <span>{{ t('screenings.cinemaLabel') }}</span>
          <select v-model="cinema">
            <option value="all">{{ t('screenings.allCinemas') }}</option>
            <option v-for="[slug, name] in venues" :key="slug" :value="slug">{{ name }}</option>
          </select>
        </label>
        <label>
          <span>{{ t('screenings.dateLabel') }}</span>
          <input v-model="date" type="date" />
        </label>
        <label class="screenings-upcoming">
          <input v-model="upcomingOnly" type="checkbox" />
          <span>{{ t('screenings.upcomingOnly') }}</span>
        </label>
      </div>

      <p v-if="loading" class="screenings-message" role="status">{{ t('screenings.loading') }}</p>
      <div v-else-if="error" class="screenings-message" role="alert">
        <p>{{ t('screenings.unavailable') }}</p>
        <button type="button" class="screenings-retry" @click="reload">
          {{ t('screenings.retry') }}
        </button>
      </div>
      <template v-else>
        <p class="screenings-count" role="status">
          {{ t('screenings.count', { count: filtered.length }) }}
        </p>
        <p v-if="!filtered.length" class="screenings-message">{{ t('screenings.empty') }}</p>
        <div v-else class="screenings-list">
          <article v-for="item in filtered" :key="item.id" class="screenings-card">
            <time :datetime="item.startsAt" class="screenings-card__time">
              <v-icon icon="mdi-calendar-clock" size="17" />
              {{ displayDate(item.startsAt) }}
            </time>
            <h2>{{ item.movieTitle }}</h2>
            <div class="screenings-card__venue">
              <v-icon icon="mdi-map-marker-outline" size="17" />
              {{ cinemaName(item) }}
              <span>·</span>
              {{ matchingHall(item)?.hallName ?? t('screenings.hallUnconfirmed') }}
            </div>
            <div class="screenings-card__links">
              <RouterLink
                v-if="matchingHall(item)"
                :to="
                  matchingHall(item)?.modelId
                    ? '/auditoriums/' + matchingHall(item)?.modelId
                    : '/directory/' + matchingHall(item)?.slug
                "
              >
                {{
                  matchingHall(item)?.modelId
                    ? t('screenings.previewSeat')
                    : t('screenings.venueInfo')
                }}
              </RouterLink>
              <span v-else class="screenings-card__unknown">{{
                t('screenings.hallUnconfirmed')
              }}</span>
              <a :href="item.sourceUrl" target="_blank" rel="noopener noreferrer">
                {{ t('screenings.viewSource') }}
                <v-icon icon="mdi-open-in-new" size="15" />
              </a>
            </div>
          </article>
        </div>
      </template>

      <footer class="screenings-source">
        <p>{{ t('screenings.notice') }}</p>
        <a href="https://data.gov.tw/dataset/6010" target="_blank" rel="noopener noreferrer">
          {{ t('screenings.attribution') }}
        </a>
        <p v-if="loadedAt">{{ t('screenings.updatedAt', { date: displayDate(loadedAt) }) }}</p>
      </footer>
    </section>
  </section>
</template>
