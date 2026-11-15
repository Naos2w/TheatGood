<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
const { t } = useI18n()
</script>

<template>
  <section class="container history-page">
    <span class="eyebrow">{{ t('history.eyebrow') }}</span>
    <h1 class="history-page__title">{{ t('history.title') }}</h1>

    <div class="history-empty">
      <div class="history-empty__icon" aria-hidden="true">
        <v-icon icon="mdi-ticket-outline" size="38" />
      </div>
      <h2>{{ t('history.emptyTitle') }}</h2>
      <p>{{ t('history.emptyDescription') }}</p>
      <span class="history-empty__status">{{ t('history.comingSoon') }}</span>
      <RouterLink to="/" class="button-primary">
        {{ t('history.explore') }}
        <v-icon icon="mdi-arrow-right" size="20" />
      </RouterLink>
    </div>
  </section>
</template>
