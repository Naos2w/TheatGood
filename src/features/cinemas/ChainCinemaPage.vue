<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'
import { appLocale } from '../../composables/usePreferences'
import { chainCinemas } from './chain-directory'
import {
  cinemaPublishedFacts,
  publishedNamedHallsForCinema,
  publishedNamedHallSeatSum,
} from './other-chain-facts'
import { VIESHOW_HALL_SOURCE, VIESHOW_HALL_SOURCE_DATE } from './vieshow-halls'
import { officialShowtimeLink } from './official-showtimes'

const route = useRoute()
const { t } = useI18n()
const cinema = computed(() => chainCinemas.find((venue) => venue.slug === route.params.slug))
const slug = computed(() => cinema.value?.slug ?? '')
const showtime = computed(() => officialShowtimeLink(slug.value))
const halls = computed(() => publishedNamedHallsForCinema(slug.value))
const facts = computed(() => cinemaPublishedFacts[slug.value])

const summaryHallCount = computed(() => halls.value.length || facts.value?.hallCount)
const summarySeatCount = computed(() =>
  halls.value.length ? publishedNamedHallSeatSum(slug.value) : facts.value?.publishedSeatCount,
)
const summaryHallLabel = computed(() => {
  if (halls.value.length) return 'chainDetail.publishedHalls'
  switch (facts.value?.hallCountScope) {
    case 'entire-cinema':
      return 'chainDetail.entireCinemaHalls'
    case 'digital-halls':
      return 'chainDetail.digitalHalls'
    case 'royal-only':
      return 'chainDetail.royalHalls'
    default:
      return 'chainDetail.publishedHalls'
  }
})
const summarySeatLabel = computed(() => {
  if (halls.value.length) return 'chainDetail.publishedSeats'
  return facts.value?.hallCountScope === 'royal-only'
    ? 'chainDetail.royalSeats'
    : 'chainDetail.entireCinemaSeats'
})
const provenanceUrl = computed(() =>
  halls.value.length && cinema.value?.brand === 'vieshow'
    ? VIESHOW_HALL_SOURCE
    : (facts.value?.sourceUrl ?? cinema.value?.sourceUrl ?? ''),
)
const provenanceDate = computed(() =>
  halls.value.length && cinema.value?.brand === 'vieshow'
    ? VIESHOW_HALL_SOURCE_DATE
    : facts.value?.checkedAt,
)
const namedFormats = computed(() => facts.value?.namedFormats ?? [])
const hasVenueMetrics = computed(
  () => summaryHallCount.value !== undefined || summarySeatCount.value !== undefined,
)
const fmt = (value: number): string => new Intl.NumberFormat(appLocale.value).format(value)
const isNumericHall = (value: string): boolean => /^\d+$/.test(value)
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
        <div class="chain-cinema-page__header-actions">
          <a
            v-if="showtime"
            :href="showtime.url"
            target="_blank"
            rel="noopener noreferrer"
            class="chain-cinema-page__showtime-link"
          >
            {{ t('chainDetail.officialShowtimes') }}
            <v-icon icon="mdi-open-in-new" size="16" />
          </a>
          <a
            :href="facts?.sourceUrl ?? cinema.sourceUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="chain-cinema-page__source-link"
          >
            {{ t('chainDetail.officialSite') }}
            <v-icon icon="mdi-open-in-new" size="16" />
          </a>
        </div>
      </header>
      <p v-if="showtime" class="chain-cinema-page__official-note">
        {{
          t(
            showtime.scope === 'brand'
              ? 'chainDetail.chooseOfficialVenue'
              : 'chainDetail.showtimesExternalNote',
          )
        }}
      </p>

      <div v-if="hasVenueMetrics" class="chain-cinema-page__summary">
        <div v-if="summaryHallCount !== undefined">
          <strong>{{ fmt(summaryHallCount) }}</strong>
          <span>{{ t(summaryHallLabel) }}</span>
        </div>
        <div v-if="summarySeatCount !== undefined">
          <strong>{{ fmt(summarySeatCount) }}</strong>
          <span>{{ t(summarySeatLabel) }}</span>
        </div>
      </div>

      <div v-if="namedFormats.length && !halls.length" class="chain-cinema-page__formats">
        <strong>{{ t('chainDetail.venueFormats') }}</strong>
        <div>
          <span v-for="format in namedFormats" :key="format">{{ format }}</span>
        </div>
        <small>{{ t('chainDetail.formatWarning') }}</small>
      </div>

      <div class="chain-cinema-page__subheading">
        <h2>{{ t('chainDetail.hallList') }}</h2>
        <span v-if="provenanceDate">
          {{
            t(
              halls.length && cinema.brand === 'vieshow'
                ? 'chainDetail.countsAsOf'
                : 'chainDetail.checkedOn',
              { date: provenanceDate },
            )
          }}
        </span>
      </div>

      <div v-if="halls.length" class="chain-cinema-page__list">
        <article v-for="hall in halls" :key="hall.label" class="chain-cinema-page__hall">
          <div>
            <strong>
              {{
                isNumericHall(hall.label)
                  ? t('chainDetail.hallNumber', { number: hall.label })
                  : hall.label
              }}
            </strong>
            <small>{{ t('chainDetail.countOnly') }}</small>
            <small
              v-if="hall.screenWidthM && hall.screenHeightM"
              class="chain-cinema-page__screen-fact"
            >
              {{
                t('chainDetail.screenDimensions', {
                  width: hall.screenWidthM,
                  height: hall.screenHeightM,
                })
              }}
              <a
                v-if="hall.screenSourceUrl"
                :href="hall.screenSourceUrl"
                target="_blank"
                rel="noopener noreferrer"
                >{{ t('chainDetail.screenSource') }}</a
              >
            </small>
          </div>
          <span>{{ t('chainDetail.seats', { count: fmt(hall.publishedSeatCount) }) }}</span>
        </article>
      </div>

      <p v-else class="chain-cinema-page__empty">
        {{
          t(
            hasVenueMetrics || namedFormats.length
              ? 'chainDetail.noHallBreakdown'
              : 'chainDetail.notYetVerified',
          )
        }}
      </p>

      <div class="chain-cinema-page__provenance">
        <v-icon icon="mdi-information-outline" size="19" />
        <div>
          <p>{{ t('chainDetail.notice') }}</p>
          <p v-if="facts?.hallCountScope === 'royal-only'">
            {{
              t(
                cinema.slug === 'miranew-taimall'
                  ? 'chainDetail.royalScopeNote'
                  : 'chainDetail.dazhiScopeNote',
              )
            }}
          </p>
          <a :href="provenanceUrl" target="_blank" rel="noopener noreferrer">
            {{
              t(
                cinema.brand === 'vieshow'
                  ? 'chainDetail.publishedSource'
                  : 'chainDetail.operatorFacts',
              )
            }}
            <v-icon icon="mdi-open-in-new" size="14" />
          </a>
        </div>
      </div>
    </template>

    <p v-else class="search-empty" role="status">{{ t('chainDetail.notFound') }}</p>
  </section>
</template>
