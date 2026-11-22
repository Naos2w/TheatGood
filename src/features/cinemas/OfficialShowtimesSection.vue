<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { chainCinemas, searchChainCinemas, type ChainBrand } from './chain-directory'
import { officialShowtimeLink } from './official-showtimes'

const { t } = useI18n()
const query = ref('')
const brand = ref<ChainBrand | 'all'>('all')
const city = ref('all')
const expanded = ref(false)
// Timetable links are distinct from source-only venue listings. The extra 26
// branch records have no independently validated timetable URL yet.
const cinemaWithTimetables = chainCinemas.filter((cinema) => officialShowtimeLink(cinema.slug))
const cities = [...new Set(cinemaWithTimetables.map((cinema) => cinema.city))].sort()
const brands = ['all', 'vieshow', 'showtime', 'miramar', 'miranew'] as const
const results = computed(() =>
  searchChainCinemas(query.value, brand.value, city.value).filter((cinema) =>
    officialShowtimeLink(cinema.slug),
  ),
)
const visible = computed(() => (expanded.value ? results.value : results.value.slice(0, 8)))
const remaining = computed(() => Math.max(0, results.value.length - 8))
</script>

<template>
  <section class="official-showtimes" aria-labelledby="official-showtimes-heading">
    <div class="official-showtimes__heading">
      <div>
        <span class="eyebrow">{{ t('screenings.officialEyebrow') }}</span>
        <h2 id="official-showtimes-heading">{{ t('screenings.officialTitle') }}</h2>
        <p>{{ t('screenings.officialDescription') }}</p>
      </div>
      <span class="official-showtimes__count">
        {{
          t('screenings.officialCount', {
            count: results.length,
            total: cinemaWithTimetables.length,
          })
        }}
      </span>
    </div>

    <div class="official-showtimes__filters">
      <label>
        <span>{{ t('screenings.officialSearchLabel') }}</span>
        <input v-model="query" type="search" :placeholder="t('screenings.officialSearch')" />
      </label>
      <label>
        <span>{{ t('screenings.officialBrand') }}</span>
        <select v-model="brand">
          <option v-for="value in brands" :key="value" :value="value">
            {{
              t(
                'home.chain' +
                  (value === 'all'
                    ? 'All'
                    : value === 'vieshow'
                      ? 'Vieshow'
                      : value === 'showtime'
                        ? 'Showtime'
                        : value === 'miramar'
                          ? 'Miramar'
                          : 'Miranew'),
              )
            }}
          </option>
        </select>
      </label>
      <label>
        <span>{{ t('screenings.officialCity') }}</span>
        <select v-model="city">
          <option value="all">{{ t('home.allCities') }}</option>
          <option v-for="name in cities" :key="name" :value="name">{{ name }}</option>
        </select>
      </label>
    </div>

    <div v-if="visible.length" class="official-showtimes__list">
      <article v-for="cinema in visible" :key="cinema.slug" class="official-showtimes__cinema">
        <div>
          <strong>{{ cinema.name }}</strong>
          <span>{{ cinema.city }} · {{ cinema.address }}</span>
          <small v-if="officialShowtimeLink(cinema.slug)?.scope === 'brand'">
            {{ t('screenings.officialChooseVenue') }}
          </small>
        </div>
        <div class="official-showtimes__actions">
          <RouterLink :to="'/cinemas/' + cinema.slug">
            {{ t('screenings.officialVenueInfo') }}
          </RouterLink>
          <a
            :href="officialShowtimeLink(cinema.slug)?.url"
            target="_blank"
            rel="noopener noreferrer"
            :aria-label="t('screenings.officialOpenAria', { name: cinema.name })"
          >
            {{ t('screenings.officialOpen') }}
            <v-icon icon="mdi-open-in-new" size="16" />
          </a>
        </div>
      </article>
    </div>
    <p v-else class="search-empty" role="status">{{ t('screenings.officialNoResults') }}</p>

    <button
      v-if="results.length > 8"
      class="official-showtimes__more"
      type="button"
      :aria-expanded="expanded"
      @click="expanded = !expanded"
    >
      {{
        expanded ? t('screenings.officialLess') : t('screenings.officialMore', { count: remaining })
      }}
      <v-icon :icon="expanded ? 'mdi-chevron-up' : 'mdi-chevron-down'" size="18" />
    </button>
    <p class="official-showtimes__disclaimer">
      <v-icon icon="mdi-information-outline" size="17" />
      {{ t('screenings.officialDisclaimer') }}
    </p>
  </section>
</template>
