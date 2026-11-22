<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { appLocale } from '../../composables/usePreferences'
import {
  loadLocalShowtimeResearchIndex,
  type ShowtimeResearchHall,
} from '../viewer/showtime-local-research'

const props = defineProps<{ cinemaSlug: string }>()
const english = computed(() => appLocale.value.startsWith('en'))
const halls = ref<ShowtimeResearchHall[]>([])
const coveredCount = ref(0)
const loading = ref(true)
const unavailable = ref(false)

watch(
  () => props.cinemaSlug,
  async (slug, _, onCleanup) => {
    const controller = new AbortController()
    onCleanup(() => controller.abort())
    halls.value = []
    unavailable.value = false
    loading.value = true
    try {
      const index = await loadLocalShowtimeResearchIndex(slug, controller.signal)
      if (controller.signal.aborted) return
      halls.value = index.venues[slug] ?? []
      coveredCount.value = index.verifiedHallLabels
    } catch {
      if (!controller.signal.aborted) unavailable.value = true
    } finally {
      if (!controller.signal.aborted) loading.value = false
    }
  },
  { immediate: true },
)
</script>

<template>
  <section id="showtime-local-3d-research" class="seat-references showtime-research-gallery">
    <div class="seat-references__heading">
      <div>
        <h2>{{ english ? '3D seat-view research' : '3D 座位視角研究' }}</h2>
        <p>
          {{
            english
              ? 'Original seat IDs and relative aisles, with estimated screen and room dimensions.'
              : '保留來源座號與走道；銀幕尺寸及空間距離為估算，不是實體測量。'
          }}
        </p>
      </div>
    </div>
    <p v-if="loading" role="status">
      {{ english ? 'Checking local source verification…' : '正在核對 MSI 本機座圖來源…' }}
    </p>
    <div v-else-if="unavailable" role="note" class="showtime-research-gallery__notice">
      <v-icon icon="mdi-shield-lock-outline" size="21" aria-hidden="true" />
      {{
        english
          ? 'Private auditorium previews are only available on the MSI development server. They are not included in the public site or UAT build.'
          : '完整座圖只在 MSI 本機開發模式提供，不會包含在公開網站或 UAT 建置中。'
      }}
    </div>
    <template v-else>
      <p class="showtime-research-gallery__notice">
        <v-icon icon="mdi-flask-outline" size="20" aria-hidden="true" />
        {{
          english
            ? halls.length +
              ' locally verified halls in this cinema · ' +
              coveredCount +
              ' across the Showtime sample'
            : '本館 ' +
              halls.length +
              ' 個影廳可在本機研究預覽；秀泰樣本已核對 ' +
              coveredCount +
              ' 廳'
        }}
      </p>
      <div class="vieshow-hall-selector__grid">
        <RouterLink
          v-for="hall in halls"
          :key="hall.hallLabel"
          class="vieshow-hall-selector__tile vieshow-hall-selector__link"
          :to="'/cinemas/' + cinemaSlug + '/halls/' + encodeURIComponent(hall.hallLabel)"
        >
          <span class="vieshow-hall-selector__tile-heading">
            <strong>{{ hall.hallLabel }}</strong>
            <small>{{ hall.ordinarySeatCount }} {{ english ? 'seats' : '座' }}</small>
          </span>
          <span class="vieshow-hall-selector__format-slot">
            <span class="vieshow-hall-selector__format-default">
              <v-icon icon="mdi-cube-outline" size="14" aria-hidden="true" />
              {{ english ? 'Estimated 3D preview' : '估算 3D 預覽' }}
            </span>
          </span>
          <span class="vieshow-hall-selector__tile-action">
            {{ english ? 'Select seat' : '選座位' }}
            <v-icon icon="mdi-chevron-right" size="16" aria-hidden="true" />
          </span>
        </RouterLink>
      </div>
    </template>
  </section>
</template>

<style scoped>
.showtime-research-gallery__notice {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 12px 0 22px;
  padding: 12px 14px;
  border-radius: 13px;
  border: 1px solid rgba(128, 143, 164, 0.28);
  background: rgba(116, 137, 154, 0.06);
  line-height: 1.6;
}
.showtime-research-gallery__notice .v-icon {
  flex: 0 0 auto;
  margin-top: 2px;
}
</style>
