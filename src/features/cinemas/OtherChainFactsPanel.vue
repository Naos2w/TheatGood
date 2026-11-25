<script setup lang="ts">
import { computed } from 'vue'
import { appLocale } from '../../composables/usePreferences'
import { useI18n } from 'vue-i18n'
import type { ChainCinema } from './chain-directory'
import { broadwaySeatLayoutsForCinema } from './broadway-seat-layouts'
import { centuryasiaSeatLayoutsForCinema } from './centuryasia-seat-layouts'
import { in89SeatChartsForCinema } from './in89-public-seat-chart'
import {
  cinemaPublishedFacts,
  publishedNamedHallsForCinema,
  type HallCountScope,
} from './other-chain-facts'

const props = defineProps<{ cinema: ChainCinema }>()
const { t } = useI18n()
const english = computed(() => appLocale.value.startsWith('en'))
const facts = computed(() => cinemaPublishedFacts[props.cinema.slug])
const namedHalls = computed(() => publishedNamedHallsForCinema(props.cinema.slug))
const somePublicSeatGridVerified = computed(
  () =>
    broadwaySeatLayoutsForCinema(props.cinema.slug).length > 0 ||
    centuryasiaSeatLayoutsForCinema(props.cinema.slug).length > 0 ||
    in89SeatChartsForCinema(props.cinema.slug).length > 0,
)
const sourceUrl = computed(
  () => facts.value?.sourceUrl ?? namedHalls.value[0]?.sourceUrl ?? props.cinema.sourceUrl,
)
// Prefer the latest checked date of the hall facts actually displayed, rather
// than an older venue-level observation (e.g. Miramar's 2026-11-23 correction).
const sourceCheckedAt = computed(() =>
  [
    props.cinema.checkedAt,
    facts.value?.checkedAt,
    ...namedHalls.value.map((hall) => hall.sourceDate),
  ]
    .filter((date): date is string => Boolean(date))
    .sort()
    .at(-1)!,
)

function countLabel(scope: HallCountScope | undefined): string {
  if (scope === 'digital-halls') return t('chainDetail.digitalHalls')
  if (scope === 'royal-only') return t('chainDetail.royalHalls')
  return t('chainDetail.entireCinemaHalls')
}
function displayHallName(label: string): string {
  return /^\d+$/.test(label) ? t('chainDetail.hallNumber', { number: label }) : label
}
</script>

<template>
  <section class="chain-facts" aria-labelledby="chain-facts-heading">
    <div class="chain-facts__heading">
      <v-icon icon="mdi-information-outline" size="22" />
      <div>
        <h2 id="chain-facts-heading">{{ t('chainDetail.branchOverview') }}</h2>
        <p v-if="!somePublicSeatGridVerified">{{ t('chainDetail.noVerifiedSeatMap') }}</p>
      </div>
    </div>

    <div v-if="facts" class="chain-facts__summary">
      <div v-if="facts.hallCount !== undefined" class="chain-facts__metric">
        <span>{{ countLabel(facts.hallCountScope) }}</span>
        <strong>{{ facts.hallCount }}</strong>
      </div>
      <div v-if="facts.publishedSeatCount !== undefined" class="chain-facts__metric">
        <span>{{ t('chainDetail.reportedSeatCount') }}</span>
        <strong>{{ facts.publishedSeatCount.toLocaleString() }}</strong>
      </div>
    </div>

    <div v-if="facts?.namedFormats?.length" class="chain-facts__formats">
      <h3>{{ t('chainDetail.venueFormats') }}</h3>
      <div class="chain-facts__chips">
        <span v-for="format in facts.namedFormats" :key="format">{{ format }}</span>
      </div>
      <p>{{ t('chainDetail.formatWarning') }}</p>
    </div>

    <div v-if="namedHalls.length" class="chain-facts__halls">
      <h3>{{ t('chainDetail.publishedHalls') }}</h3>
      <p v-if="!somePublicSeatGridVerified">{{ t('chainDetail.publishedNamedHallsNote') }}</p>
      <p v-else>
        {{
          english
            ? 'These are published hall capacities. Source-backed 2D/3D layouts are available below for selected halls only; other halls still need complete seat grids.'
            : '以下是官方公布席數；部分影廳已取得完整公開座圖，其餘仍待補。已驗證的 2D／3D 入口見下方。'
        }}
      </p>
      <div class="chain-facts__hall-grid">
        <div v-for="hall in namedHalls" :key="hall.label" class="chain-facts__hall">
          <strong>{{ displayHallName(hall.label) }}</strong>
          <span>{{ t('chainDetail.seats', { count: hall.publishedSeatCount }) }}</span>
          <small v-if="hall.screenWidthM && hall.screenHeightM">
            {{
              t('chainDetail.screenDimensions', {
                width: hall.screenWidthM,
                height: hall.screenHeightM,
              })
            }}
          </small>
        </div>
      </div>
    </div>
    <p v-else class="chain-facts__note">{{ t('chainDetail.noHallBreakdown') }}</p>

    <p v-if="cinema.slug === 'miranew-taimall'" class="chain-facts__note">
      {{ t('chainDetail.royalScopeNote') }}
    </p>
    <p v-if="cinema.slug === 'miranew-dazhi-royal'" class="chain-facts__note">
      {{ t('chainDetail.dazhiScopeNote') }}
    </p>

    <div class="chain-facts__source">
      <span>{{ t('chainDetail.checkedOn', { date: sourceCheckedAt }) }}</span>
      <a :href="sourceUrl" target="_blank" rel="noopener noreferrer">
        <v-icon icon="mdi-open-in-new" size="16" />
        {{ t('chainDetail.operatorFacts') }}
      </a>
    </div>
  </section>
</template>
