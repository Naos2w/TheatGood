<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { appLocale } from '../../composables/usePreferences'
import { in89SeatChartsForCinema } from './in89-public-seat-chart'

const props = defineProps<{ cinemaSlug: string }>()
const english = computed(() => appLocale.value.startsWith('en'))
const layouts = computed(() => in89SeatChartsForCinema(props.cinemaSlug))
</script>

<template>
  <section
    v-if="layouts.length"
    id="in89-institution-chart"
    class="seat-references"
    aria-labelledby="in89-chart-heading"
  >
    <div class="seat-references__heading">
      <div>
        <h2 id="in89-chart-heading">
          {{ english ? 'Dated public seating diagram' : '公開活動座位圖（有日期註記）' }}
        </h2>
        <p>
          {{
            english
              ? 'National Chiayi Senior High School published this COACH Hall 2 seating chart in January and February 2026. The cinema still lists 95 positions in November, but the latest physical row/aisle arrangement has not been re-measured.'
              : '國立嘉義高中於 2026 年 1、2 月公開 COACH 第2廳座位表；in89 11月公告仍為 95 個座位位置，但尚未重新實測最新座號與走道配置。'
          }}
        </p>
      </div>
    </div>
    <div class="vieshow-hall-selector">
      <div class="vieshow-hall-selector__grid">
        <RouterLink
          v-for="hall in layouts"
          :key="hall.id"
          :to="'/cinemas/' + cinemaSlug + '/halls/' + encodeURIComponent(hall.id)"
          class="vieshow-hall-selector__tile vieshow-hall-selector__link"
        >
          <span class="vieshow-hall-selector__tile-heading">
            <strong>{{ hall.hallLabel }}</strong>
            <small>
              {{ hall.ordinarySeatCount }}
              {{ english ? 'documented seats' : '個座號' }}
              · {{ hall.wheelchairMarkers }}
              {{ english ? 'accessible positions' : '個無障礙位置' }}
            </small>
          </span>
          <span class="vieshow-hall-selector__format-slot">
            <span class="vieshow-hall-selector__format-default">
              <v-icon icon="mdi-seat-outline" size="14" />
              {{ english ? 'Jan–Feb 2026 chart' : '2026 年初活動座圖' }}
            </span>
          </span>
          <span class="vieshow-hall-selector__tile-action">
            {{ english ? 'View sourced 2D / estimated 3D' : '查看來源 2D／估算 3D' }}
            <v-icon icon="mdi-chevron-right" size="16" />
          </span>
        </RouterLink>
      </div>
    </div>
    <p class="vieshow-3d-page__assumption" role="note">
      {{
        english
          ? 'Source: two dated school publications cross-checked against the cinema’s hall and current total capacity. The original event image is not reproduced; 3D metres, seat pitch and rake are estimates.'
          : '來源為兩篇學校公開活動公告，並與影城廳號及最新總位置數交叉核對。未複製活動原圖；3D 座距、尺寸與坡度皆為估算。'
      }}
    </p>
    <p>
      <a
        href="https://www.cysh.cy.edu.tw/p/406-1008-134339%2Cr12.php?Lang=zh-tw"
        target="_blank"
        rel="noopener noreferrer"
        >{{ english ? 'Published diagram (February 2026)' : '查看 2026 年 2 月公開座圖來源' }}</a
      >
    </p>
  </section>
</template>
