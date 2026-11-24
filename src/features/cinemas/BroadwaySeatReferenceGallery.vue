<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { appLocale } from '../../composables/usePreferences'
import { broadwaySeatLayoutsForCinema } from './broadway-seat-layouts'

const props = defineProps<{ cinemaSlug: string }>()
const english = computed(() => appLocale.value.startsWith('en'))
const layouts = computed(() => broadwaySeatLayoutsForCinema(props.cinemaSlug))
const linkFor = (hallId: string) =>
  '/cinemas/' + props.cinemaSlug + '/halls/' + encodeURIComponent(hallId)
</script>

<template>
  <section
    v-if="layouts.length"
    id="broadway-seat-references"
    class="seat-references"
    aria-labelledby="broadway-seat-references-heading"
  >
    <div class="seat-references__heading">
      <div>
        <h2 id="broadway-seat-references-heading">
          {{ english ? 'Verified public seating plans' : '已核對的公開座位圖' }}
        </h2>
        <p>
          {{
            english
              ? 'Broadway official QUICK VIEW: numbered seats and aisle gaps are sourced; distance and screen size are estimated.'
              : '來源：百老匯官方 QUICK VIEW。座號與走道有公開來源；銀幕尺寸、實際距離與坡度仍為估算。'
          }}
        </p>
      </div>
    </div>
    <div class="vieshow-hall-selector">
      <div class="vieshow-hall-selector__grid">
        <RouterLink
          v-for="hall in layouts"
          :key="hall.id"
          :to="linkFor(hall.id)"
          class="vieshow-hall-selector__tile vieshow-hall-selector__link"
        >
          <span class="vieshow-hall-selector__tile-heading">
            <strong>{{ hall.hallLabel }}</strong>
            <small>
              {{
                english
                  ? hall.ordinarySeatCount + ' verified numbered seats'
                  : hall.ordinarySeatCount + ' 個已核實座號'
              }}
            </small>
          </span>
          <span class="vieshow-hall-selector__format-slot">
            <span class="vieshow-hall-selector__format-default">
              <v-icon icon="mdi-seat-outline" size="14" />
              {{ english ? 'Source-backed grid' : '官方座位格線' }}
            </span>
          </span>
          <span class="vieshow-hall-selector__tile-action">
            {{ english ? 'View seats in 2D / 3D' : '查看 2D／3D 座位' }}
            <v-icon icon="mdi-chevron-right" size="16" />
          </span>
        </RouterLink>
      </div>
    </div>
  </section>
</template>
