<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { chainCinemas, searchChainCinemas, type ChainBrand } from './chain-directory'

const props = defineProps<{ query: string; city: string }>()
const { t } = useI18n()
const selectedBrand = ref<ChainBrand | 'all'>('all')
const expanded = ref(false)
const brandNames = [
  { value: 'all', label: 'home.chainAll' },
  { value: 'vieshow', label: 'home.chainVieshow' },
  { value: 'showtime', label: 'home.chainShowtime' },
  { value: 'miramar', label: 'home.chainMiramar' },
  { value: 'miranew', label: 'home.chainMiranew' },
] as const

const filtered = computed(() => searchChainCinemas(props.query, selectedBrand.value, props.city))
const visible = computed(() => (expanded.value ? filtered.value : filtered.value.slice(0, 8)))
const moreAvailable = computed(() => filtered.value.length > 8)
const total = chainCinemas.length
</script>

<template>
  <section class="chain-directory" aria-labelledby="chain-directory-heading">
    <div class="chain-directory__heading">
      <div>
        <h2 id="chain-directory-heading">{{ t('home.chainsTitle') }}</h2>
        <p>{{ t('home.chainsLead') }}</p>
      </div>
      <span class="chain-directory__total">{{
        t('home.chainsCount', { count: filtered.length, total })
      }}</span>
    </div>

    <label class="chain-directory__brand">
      <span>{{ t('home.chainBrand') }}</span>
      <select v-model="selectedBrand">
        <option v-for="brand in brandNames" :key="brand.value" :value="brand.value">
          {{ t(brand.label) }}
        </option>
      </select>
    </label>

    <div v-if="visible.length" class="chain-directory__list">
      <article v-for="cinema in visible" :key="cinema.slug" class="chain-cinema">
        <span class="chain-cinema__symbol" aria-hidden="true">
          <v-icon icon="mdi-movie-open-outline" size="22" />
        </span>
        <div class="chain-cinema__details">
          <strong>{{ cinema.name }}</strong>
          <span>{{ cinema.city }} · {{ cinema.address }}</span>
          <small>{{ t('home.chainNoModel') }}</small>
        </div>
        <a
          :href="cinema.sourceUrl"
          :aria-label="t('home.chainSourceAria', { name: cinema.name })"
          target="_blank"
          rel="noopener noreferrer"
          class="chain-cinema__link"
        >
          <v-icon icon="mdi-open-in-new" size="18" />
        </a>
      </article>
    </div>
    <p v-else class="search-empty">{{ t('home.chainNoResults') }}</p>

    <button
      v-if="moreAvailable"
      class="chain-directory__more"
      type="button"
      :aria-expanded="expanded"
      @click="expanded = !expanded"
    >
      {{ expanded ? t('home.chainLess') : t('home.chainMore', { count: filtered.length - 8 }) }}
      <v-icon :icon="expanded ? 'mdi-chevron-up' : 'mdi-chevron-down'" size="18" />
    </button>

    <p class="discovery-note">
      <v-icon icon="mdi-information-outline" size="16" />
      <span>{{ t('home.chainDisclaimer') }}</span>
    </p>
  </section>
</template>
