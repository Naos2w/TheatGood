<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ChainCinema } from './chain-directory'
import {
  cinemaPublishedFacts,
  publishedNamedHallsForCinema,
  type HallCountScope,
} from './other-chain-facts'

const props = defineProps<{ cinema: ChainCinema }>()
const { t } = useI18n()
const facts = computed(() => cinemaPublishedFacts[props.cinema.slug])
const namedHalls = computed(() => publishedNamedHallsForCinema(props.cinema.slug))
const sourceUrl = computed(
  () => facts.value?.sourceUrl ?? namedHalls.value[0]?.sourceUrl ?? props.cinema.sourceUrl,
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
        <p>{{ t('chainDetail.noVerifiedSeatMap') }}</p>
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
      <p>{{ t('chainDetail.publishedNamedHallsNote') }}</p>
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
      <span>{{ t('chainDetail.checkedOn', { date: facts?.checkedAt ?? cinema.checkedAt }) }}</span>
      <a :href="sourceUrl" target="_blank" rel="noopener noreferrer">
        <v-icon icon="mdi-open-in-new" size="16" />
        {{ t('chainDetail.operatorFacts') }}
      </a>
    </div>
  </section>
</template>
