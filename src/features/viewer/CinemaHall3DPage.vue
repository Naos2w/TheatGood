<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { chainCinemas } from '../cinemas/chain-directory'

const route = useRoute()
const cinema = computed(() =>
  chainCinemas.find((venue) => venue.slug === String(route.params.slug)),
)
const showtimePage = defineAsyncComponent(() => import('./ShowtimeResearch3DPage.vue'))
const vieshowPage = defineAsyncComponent(() => import('./VieShowEstimated3DPage.vue'))
</script>

<template>
  <component :is="showtimePage" v-if="cinema?.brand === 'showtime'" />
  <component
    :is="vieshowPage"
    v-else-if="
      cinema?.brand === 'vieshow' ||
      cinema?.brand === 'broadway' ||
      cinema?.brand === 'centuryasia' ||
      cinema?.brand === 'in89'
    "
  />
  <section v-else class="container" role="status">
    <p>此影城尚未有可驗證的 3D 座位排列來源。</p>
    <RouterLink to="/">返回影城列表</RouterLink>
  </section>
</template>
