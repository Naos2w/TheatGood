<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { appLocale } from '../../composables/usePreferences'
import { venueBrandLabel } from '../cinemas/cinema-discovery-metadata'
import { publishedNamedHallsForCinema } from '../cinemas/other-chain-facts'
import { loadVieShowArchiveForCinema } from '../cinemas/vieshow-seat-archive'
import {
  loadLocalShowtimeResearchIndex,
  type ShowtimeLocalResearchIndex,
} from './showtime-local-research'
import {
  miranewSource3DEntries,
  pendingChain3DVenues,
  showtimeSource3DEntries,
  source3DTotalByBrand,
  source3DVenues,
  vieShowSource3DEntries,
  type Source3DBrand,
  type Source3DEntry,
} from './source-3d-catalogue'

type FilterBrand = Source3DBrand | 'all'
const route = useRoute()
const router = useRouter()
const english = computed(() => appLocale.value.startsWith('en'))
const brands: { id: FilterBrand; name: string; english: string }[] = [
  { id: 'all', name: '全部', english: 'All' },
  { id: 'vieshow', name: '威秀／MUVIE', english: 'Vie Show / MUVIE' },
  { id: 'showtime', name: '秀泰', english: 'Showtime' },
  { id: 'miranew', name: '美麗新', english: 'Miranew' },
]
const allowed = new Set(brands.map((item) => item.id))
const initialBrand = String(route.query.brand ?? 'all')
const brand = ref<FilterBrand>(
  allowed.has(initialBrand as FilterBrand) ? (initialBrand as FilterBrand) : 'all',
)
const venueQuery = ref('')
const hallQuery = ref('')
const selectedKey = ref(typeof route.query.cinema === 'string' ? route.query.cinema : '')
const showtimeIndex = shallowRef<ShowtimeLocalResearchIndex | null>(null)
const showtimeLoading = ref(true)
const showtimeUnavailable = ref(false)
const loadingEntries = ref(false)
const entriesError = ref(false)
const items = shallowRef<Source3DEntry[]>([])
const venues = computed(() => source3DVenues(showtimeIndex.value))
const pendingChains = pendingChain3DVenues()
const pendingGroups = [...new Set(pendingChains.map((item) => item.brand))].map((chain) => {
  const group = pendingChains.filter((item) => item.brand === chain)
  return {
    brand: chain,
    label: venueBrandLabel(group[0]!),
    venues: group,
    hasHistoricalListings: group.some((item) => item.operatingNowVerified === false),
    publishedHallCapacityRecords: group.reduce(
      (sum, item) => sum + publishedNamedHallsForCinema(item.slug).length,
      0,
    ),
  }
})
const filteredVenues = computed(() => {
  const q = venueQuery.value.trim().toLocaleLowerCase()
  return venues.value.filter(
    (item) =>
      (brand.value === 'all' || brand.value === item.brand) &&
      (!q ||
        item.name.toLocaleLowerCase().includes(q) ||
        item.slug.toLocaleLowerCase().includes(q)),
  )
})
const selectedVenue = computed(() => venues.value.find((v) => v.key === selectedKey.value))
const displayedEntries = computed(() => {
  const q = hallQuery.value.trim().toLocaleLowerCase()
  return items.value.filter(
    (item) =>
      !q || item.label.toLocaleLowerCase().includes(q) || item.id.toLocaleLowerCase().includes(q),
  )
})
const sourcedCount = computed(() =>
  (['vieshow', 'showtime', 'miranew'] as const).reduce((n, b) => {
    const value = source3DTotalByBrand(venues.value, b)
    return n + (value ?? 0)
  }, 0),
)
function countOf(next: FilterBrand): number | null {
  return next === 'all' ? sourcedCount.value : source3DTotalByBrand(venues.value, next)
}
function setBrand(next: FilterBrand) {
  if (!allowed.has(next)) return
  brand.value = next
  venueQuery.value = ''
  hallQuery.value = ''
}
function selectVenue(key: string) {
  if (!venues.value.some((item) => item.key === key)) return
  selectedKey.value = key
  hallQuery.value = ''
}
function linkToSeat(path: string, in3D: boolean) {
  return { path, query: in3D ? { view: '3d' } : {} }
}
let controller: AbortController | null = null
onMounted(async () => {
  controller = new AbortController()
  try {
    // One privacy-gated GET for all 15 Showtime venues.
    showtimeIndex.value = await loadLocalShowtimeResearchIndex(
      'showtime-taitung',
      controller.signal,
    )
  } catch {
    if (!controller.signal.aborted) showtimeUnavailable.value = true
  } finally {
    if (!controller.signal.aborted) showtimeLoading.value = false
  }
})
onUnmounted(() => controller?.abort())

watch(
  filteredVenues,
  (next) => {
    if (!next.some((item) => item.key === selectedKey.value)) {
      selectedKey.value = next[0]?.key ?? ''
    }
  },
  { immediate: true },
)
watch(
  [selectedVenue, showtimeIndex],
  async ([venue], _, onCleanup) => {
    let active = true
    onCleanup(() => {
      active = false
    })
    items.value = []
    entriesError.value = false
    loadingEntries.value = Boolean(venue && venue.brand === 'vieshow')
    if (!venue) return
    try {
      let nextItems: Source3DEntry[]
      if (venue.brand === 'vieshow') {
        const layout = await loadVieShowArchiveForCinema(venue.slug)
        nextItems = vieShowSource3DEntries(venue.slug, layout)
      } else if (venue.brand === 'showtime') {
        nextItems = showtimeSource3DEntries(venue.slug, showtimeIndex.value)
      } else {
        nextItems = miranewSource3DEntries(venue.slug)
      }
      if (active) items.value = nextItems
    } catch {
      if (active) entriesError.value = true
    } finally {
      if (active) loadingEntries.value = false
    }
  },
  { immediate: true },
)
watch(
  [brand, selectedKey],
  ([nextBrand, nextKey]) => {
    // Normalise old deep links (including retired independent venue filters).
    // Keep the URL scoped to an actual chain venue, never a legacy hall model.
    const nextBrandQuery = nextBrand === 'all' ? undefined : nextBrand
    const nextCinemaQuery = nextKey || undefined
    if (route.query.brand === nextBrandQuery && route.query.cinema === nextCinemaQuery) return
    void router.replace({ query: { brand: nextBrandQuery, cinema: nextCinemaQuery } })
  },
  { immediate: true },
)
</script>

<template>
  <main class="container source-3d-explorer" data-no-page-swipe>
    <RouterLink to="/" class="back-link">
      <v-icon icon="mdi-chevron-left" size="19" aria-hidden="true" />
      {{ english ? 'Back to cinema directory' : '返回影城列表' }}
    </RouterLink>

    <header class="source-3d-explorer__hero">
      <span class="source-3d-explorer__eyebrow">THEATGOOD · 3D SEAT VIEWS</span>
      <h1>{{ english ? 'Explore chain cinema 3D seats' : '連鎖影城 3D 座位圖鑑' }}</h1>
      <p>
        {{
          english
            ? 'Showing chain cinemas only. Choose a chain, venue and source-verified seating plan to see an estimated 3D view; non-chain theatres are outside this phase.'
            : '現階段僅完成連鎖影城。選擇院線、分館和已核實的座位排列，查看估算 3D 視角；非連鎖影廳暫不納入圖鑑。'
        }}
      </p>
    </header>

    <section
      class="source-3d-explorer__summary"
      :aria-label="english ? 'Source coverage' : '來源座圖總覽'"
    >
      <div v-for="item in brands.slice(1)" :key="item.id" class="source-3d-explorer__summary-item">
        <strong>{{ countOf(item.id) === null ? '—' : countOf(item.id) }}</strong>
        <span>{{ english ? item.english : item.name }}</span>
      </div>
    </section>
    <p class="source-3d-explorer__caveat" role="note">
      <v-icon icon="mdi-shield-check-outline" size="18" aria-hidden="true" />
      {{
        english
          ? 'Only chain-cinema seating previews are counted, not surveyed physical auditoriums. Miranew patterns lack confirmed permanent hall numbers; Showtime grids require authorised local/Tailscale access.'
          : '僅計算連鎖影城已取得來源的座圖／座型，不代表實測實體廳數。美麗新部分座型尚無永久廳號；秀泰座圖僅限授權 MSI／Tailscale 預覽。'
      }}
    </p>
    <p
      v-if="!showtimeLoading && showtimeIndex && showtimeIndex.missingHallLabels > 0"
      class="source-3d-explorer__caveat"
      role="note"
    >
      <v-icon icon="mdi-progress-clock" size="18" aria-hidden="true" />
      {{
        english
          ? `Showtime: ${showtimeIndex.verifiedHallLabels} of ${showtimeIndex.sampledHallLabels} sampled hall labels have verified seat grids; ${showtimeIndex.missingHallLabels} still await a source before a 3D preview can be offered.`
          : `秀泰：${showtimeIndex.verifiedHallLabels}／${showtimeIndex.sampledHallLabels} 個抽樣廳號已有來源座圖，尚有 ${showtimeIndex.missingHallLabels} 廳缺少可核對座位排列，暫不提供 3D，亦不以席數推估。`
      }}
    </p>
    <aside v-if="pendingChains.length" class="source-3d-explorer__pending" role="note">
      <v-icon icon="mdi-progress-clock" size="19" aria-hidden="true" />
      <div>
        <strong>{{
          english ? 'Chain cinemas awaiting complete seating plans' : '其他連鎖影城待補完整座圖'
        }}</strong>
        <p>
          {{
            english
              ? 'These venues are in the cinema directory but do not have verified individual seat positions yet; capacities alone cannot produce a real 3D seat view.'
              : '以下影城已有場館資料，但還沒有可驗證的逐座號與走道排列；只知道席數無法產生可信的 3D 座位視角。'
          }}
        </p>
        <div class="source-3d-explorer__pending-groups">
          <details
            v-for="group in pendingGroups"
            :key="group.brand"
            class="source-3d-explorer__pending-group"
          >
            <summary>
              <strong>{{ group.label }}</strong>
              <span
                >{{ group.venues.length }}
                {{ english ? 'venues · source pending' : '間分館 · 3D 待補' }}</span
              >
            </summary>
            <div class="source-3d-explorer__pending-group-content">
              <p class="source-3d-explorer__historical-note">
                {{
                  english
                    ? group.publishedHallCapacityRecords +
                      ' published hall-capacity records (not seat grids); 3D positions still require verification.'
                    : '已有 ' +
                      group.publishedHallCapacityRecords +
                      ' 筆公開影廳席數（不是座位格線）；仍需完整座號與排／列來源才能建立 3D。'
                }}
              </p>
              <p v-if="group.hasHistoricalListings" class="source-3d-explorer__historical-note">
                {{
                  english
                    ? 'Historical operator listing (18 November 2026). Current opening status is not confirmed.'
                    : '來源為 2026／11／18 公開影城資料，尚未重新確認目前營業狀態。'
                }}
              </p>
              <div class="source-3d-explorer__pending-links">
                <RouterLink
                  v-for="venue in group.venues"
                  :key="venue.slug"
                  :to="'/cinemas/' + venue.slug"
                >
                  {{ venue.name }}
                  <v-icon icon="mdi-chevron-right" size="15" aria-hidden="true" />
                </RouterLink>
              </div>
            </div>
          </details>
        </div>
      </div>
    </aside>

    <section
      class="source-3d-explorer__browser"
      :aria-label="english ? 'Find a 3D hall' : '尋找 3D 影廳'"
    >
      <div
        class="source-3d-explorer__filters"
        role="group"
        :aria-label="english ? 'Cinema chain' : '選擇院線'"
      >
        <button
          v-for="item in brands"
          :key="item.id"
          type="button"
          :class="{ 'is-active': brand === item.id }"
          :aria-pressed="brand === item.id"
          @click="setBrand(item.id)"
        >
          {{ english ? item.english : item.name }}
        </button>
      </div>

      <div class="source-3d-explorer__fields">
        <label>
          {{ english ? 'Filter venues' : '搜尋分館' }}
          <input
            v-model="venueQuery"
            type="search"
            autocomplete="off"
            :placeholder="english ? 'Cinema or city' : '輸入影城或地區'"
          />
        </label>
        <label>
          {{ english ? 'Choose cinema' : '選擇分館／場館' }}
          <select
            :value="selectedKey"
            :disabled="!filteredVenues.length"
            @change="selectVenue(($event.target as HTMLSelectElement).value)"
          >
            <option v-for="venue in filteredVenues" :key="venue.key" :value="venue.key">
              {{ venue.name }} · {{ venue.sourceCount === null ? '—' : venue.sourceCount }}
            </option>
          </select>
        </label>
        <label>
          {{ english ? 'Find a hall or seat pattern' : '搜尋影廳或座型' }}
          <input
            v-model="hallQuery"
            type="search"
            autocomplete="off"
            :placeholder="english ? 'e.g. IMAX, Hall 12' : '例如：IMAX、第 12 廳'"
          />
        </label>
      </div>
    </section>

    <section class="source-3d-explorer__results" aria-live="polite">
      <header class="source-3d-explorer__result-heading">
        <div>
          <h2>{{ selectedVenue?.name ?? (english ? 'No matching cinema' : '沒有符合的影城') }}</h2>
          <p>
            {{
              english
                ? 'Observed source diagrams. Choose 2D to pick a seat or open the estimated 3D perspective directly.'
                : '只列出取得完整來源格線的項目。可先選 2D 座位，或直接進入估算 3D。'
            }}
          </p>
        </div>
        <span class="source-3d-explorer__count">
          {{ displayedEntries.length }} {{ english ? 'previews' : '份座圖' }}
        </span>
      </header>

      <div
        v-if="loadingEntries || (selectedVenue?.brand === 'showtime' && showtimeLoading)"
        role="status"
        class="source-3d-explorer__notice"
      >
        <v-progress-circular indeterminate size="22" color="primary" />
        {{ english ? 'Checking verified seat grids…' : '正在核對來源座圖…' }}
      </div>
      <div
        v-else-if="selectedVenue?.brand === 'showtime' && showtimeUnavailable"
        role="note"
        class="source-3d-explorer__notice"
      >
        <v-icon icon="mdi-shield-lock-outline" size="23" aria-hidden="true" />
        {{
          english
            ? 'Private Showtime hall grids are not available here. Connect through the owner-authorised MSI Tailscale preview to view them.'
            : '秀泰私有座位格線在此環境不可用；請透過已授權的 MSI Tailscale 私人預覽查看。'
        }}
      </div>
      <div v-else-if="entriesError" role="status" class="source-3d-explorer__notice">
        {{
          english
            ? 'Verified hall layouts could not be loaded.'
            : '來源座位資料載入失敗，請重新整理後再試。'
        }}
      </div>
      <div v-else-if="!displayedEntries.length" role="status" class="source-3d-explorer__notice">
        {{
          english
            ? 'No verified seating plan matches these filters.'
            : '目前沒有符合條件的已核實座圖；不會以席數猜造座位。'
        }}
      </div>
      <div v-else class="source-3d-explorer__grid">
        <article v-for="entry in displayedEntries" :key="entry.id" class="source-3d-explorer__item">
          <div class="source-3d-explorer__item-title">
            <v-icon icon="mdi-seat-recline-normal" size="21" aria-hidden="true" />
            <h3>{{ entry.label }}</h3>
          </div>
          <p class="source-3d-explorer__item-meta">
            {{ entry.count }} {{ english ? 'source seat IDs' : '個來源座號' }}
          </p>
          <p class="source-3d-explorer__item-note">
            {{
              entry.type === 'observed-pattern'
                ? english
                  ? 'Observed pattern · permanent hall unknown'
                  : '觀察座型 · 永久實體廳號未確認'
                : entry.alert === 'capacity-different'
                  ? english
                    ? 'Operator grid and published seat totals differ'
                    : '來源格線與公告席數不同'
                  : english
                    ? 'Sourced seat plan · estimated room'
                    : '來源座圖 · 空間尺度估算'
            }}
          </p>
          <div class="source-3d-explorer__actions">
            <RouterLink :to="linkToSeat(entry.path, false)" class="source-3d-explorer__secondary">
              <v-icon icon="mdi-seat-outline" size="17" aria-hidden="true" />
              {{ english ? '2D seats' : '2D 選座' }}
            </RouterLink>
            <RouterLink :to="linkToSeat(entry.path, true)" class="source-3d-explorer__primary">
              <v-icon icon="mdi-cube-outline" size="17" aria-hidden="true" />
              {{ english ? 'View in 3D' : '3D 視角' }}
            </RouterLink>
          </div>
        </article>
      </div>
    </section>
  </main>
</template>

<style scoped>
.source-3d-explorer {
  padding-top: 24px;
  padding-bottom: 70px;
}
.source-3d-explorer__hero {
  margin: 24px 0 20px;
}
.source-3d-explorer__eyebrow {
  letter-spacing: 0.12em;
  font-size: 12px;
  font-weight: 700;
  opacity: 0.66;
}
.source-3d-explorer__hero h1 {
  margin: 8px 0 9px;
  font-size: clamp(26px, 4vw, 39px);
  line-height: 1.35;
}
.source-3d-explorer__hero p {
  max-width: 760px;
  line-height: 1.75;
  opacity: 0.77;
}
.source-3d-explorer__summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin: 22px 0 10px;
}
.source-3d-explorer__summary-item {
  display: flex;
  align-items: start;
  flex-direction: column;
  gap: 7px;
  min-width: 0;
  padding: 18px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.13);
  border-radius: 17px;
  background: rgba(var(--v-theme-surface), 0.7);
}
.source-3d-explorer__summary-item strong {
  font-size: 26px;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
.source-3d-explorer__summary-item span {
  font-size: 12px;
  line-height: 1.5;
  opacity: 0.76;
}
.source-3d-explorer__caveat {
  display: flex;
  align-items: start;
  gap: 9px;
  margin: 12px 0 23px;
  font-size: 13px;
  line-height: 1.75;
  opacity: 0.75;
}
.source-3d-explorer__caveat .v-icon {
  flex: 0 0 auto;
  margin-top: 2px;
}
.source-3d-explorer__pending {
  display: flex;
  gap: 11px;
  align-items: flex-start;
  padding: 13px 15px;
  margin: -4px 0 19px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.13);
  border-radius: 13px;
  background: rgba(var(--v-theme-on-surface), 0.03);
  font-size: 13px;
}
.source-3d-explorer__pending > .v-icon {
  flex: 0 0 auto;
  margin-top: 2px;
}
.source-3d-explorer__pending p {
  margin: 4px 0 7px;
  opacity: 0.7;
  line-height: 1.55;
}
.source-3d-explorer__pending-groups {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.source-3d-explorer__pending-group {
  min-width: 0;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 12px;
  overflow: hidden;
}
.source-3d-explorer__pending-group summary {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 6px;
  cursor: pointer;
  padding: 12px;
  min-height: 44px;
}
.source-3d-explorer__pending-group summary span {
  font-size: 12px;
  opacity: 0.7;
}
.source-3d-explorer__pending-group-content {
  padding: 0 12px 12px;
}
.source-3d-explorer__pending-group .source-3d-explorer__historical-note {
  font-size: 12px;
  line-height: 1.55;
}
.source-3d-explorer__pending-links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.source-3d-explorer__pending-links a {
  display: inline-flex;
  align-items: center;
  min-height: 38px;
  padding: 6px 10px;
  border-radius: 9px;
  text-decoration: none;
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.08);
  font-weight: 650;
}
.source-3d-explorer__pending-links a:focus-visible {
  outline: 2px solid currentColor;
}
.source-3d-explorer__browser {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.13);
  border-radius: 18px;
  padding: 16px;
  background: rgba(var(--v-theme-surface), 0.55);
}
.source-3d-explorer__filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.source-3d-explorer__filters button {
  padding: 9px 13px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.15);
  border-radius: 999px;
  font-size: 13px;
  min-height: 40px;
  background: rgba(var(--v-theme-on-surface), 0.045);
}
.source-3d-explorer__filters button.is-active {
  border-color: rgba(var(--v-theme-primary), 0.6);
  background: rgba(var(--v-theme-primary), 0.14);
  font-weight: 750;
}
.source-3d-explorer__fields {
  display: grid;
  grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.5fr) minmax(0, 0.8fr);
  gap: 12px;
  margin-top: 17px;
}
.source-3d-explorer__fields label {
  min-width: 0;
  display: grid;
  gap: 7px;
  font-size: 13px;
  font-weight: 650;
}
.source-3d-explorer__fields input,
.source-3d-explorer__fields select {
  width: 100%;
  min-width: 0;
  padding: 10px 12px;
  min-height: 44px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.19);
  border-radius: 11px;
  background: rgba(var(--v-theme-surface), 0.9);
  color: inherit;
  font: inherit;
}
.source-3d-explorer__fields input::placeholder {
  opacity: 0.56;
}
.source-3d-explorer__results {
  padding-top: 20px;
}
.source-3d-explorer__result-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 8px 0 16px;
}
.source-3d-explorer__result-heading h2 {
  font-size: clamp(18px, 2.7vw, 23px);
}
.source-3d-explorer__result-heading p {
  font-size: 13px;
  margin: 6px 0 0;
  line-height: 1.65;
  opacity: 0.7;
}
.source-3d-explorer__count {
  flex: 0 0 auto;
  font-size: 13px;
  color: rgb(var(--v-theme-primary));
  font-weight: 750;
}
.source-3d-explorer__notice {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 14px;
  font-size: 14px;
  line-height: 1.65;
}
.source-3d-explorer__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.source-3d-explorer__item {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 15px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.13);
  border-radius: 16px;
  background: rgba(var(--v-theme-surface), 0.73);
}
.source-3d-explorer__item-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.source-3d-explorer__item-title h3 {
  min-width: 0;
  font-size: 16px;
  overflow-wrap: anywhere;
}
.source-3d-explorer__item-title .v-icon {
  flex: 0 0 auto;
}
.source-3d-explorer__item-meta {
  margin: 10px 0 4px;
  font-size: 13px;
  font-weight: 650;
}
.source-3d-explorer__item-note {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  opacity: 0.65;
}
.source-3d-explorer__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: auto;
  padding-top: 16px;
}
.source-3d-explorer__actions a {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 9px 11px;
  min-height: 42px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.18);
  border-radius: 11px;
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
}
.source-3d-explorer__secondary {
  color: rgb(var(--v-theme-on-surface));
}
.source-3d-explorer__primary {
  background: rgba(var(--v-theme-primary), 0.14);
  color: rgb(var(--v-theme-primary));
}
.source-3d-explorer__actions a:hover,
.source-3d-explorer__actions a:focus-visible {
  outline: 2px solid rgba(var(--v-theme-primary), 0.58);
  outline-offset: 2px;
}
@media (max-width: 920px) {
  .source-3d-explorer__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .source-3d-explorer__fields {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .source-3d-explorer__fields label:nth-child(2) {
    grid-column: span 2;
    grid-row: 1;
  }
}
@media (max-width: 600px) {
  .source-3d-explorer {
    padding-top: 10px;
  }
  .source-3d-explorer__pending-groups {
    grid-template-columns: 1fr;
  }
  .source-3d-explorer__summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  .source-3d-explorer__summary-item {
    padding: 13px;
    border-radius: 13px;
  }
  .source-3d-explorer__summary-item strong {
    font-size: 23px;
  }
  .source-3d-explorer__browser {
    padding: 12px;
    border-radius: 13px;
  }
  .source-3d-explorer__fields {
    grid-template-columns: 1fr;
  }
  .source-3d-explorer__fields label:nth-child(2) {
    grid-column: auto;
    grid-row: auto;
  }
  .source-3d-explorer__grid {
    grid-template-columns: 1fr;
    gap: 10px;
  }
  .source-3d-explorer__result-heading {
    align-items: start;
  }
  .source-3d-explorer__item {
    padding: 13px;
  }
}
</style>
