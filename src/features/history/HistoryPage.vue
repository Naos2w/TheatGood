<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'
import SeatMap from '../../components/SeatMap.vue'
import {
  groupWatchFootprints,
  footstepVisitsForSeat,
  type SeatFootprintGroup,
} from './seat-footprints'
import { findAuditorium } from '../auditoriums/catalog'
import { cinemaDirectory } from '../auditoriums/directory'
import { createSeats } from '../auditoriums/geometry'
import {
  filterWatchHistory,
  makeManualDraft,
  summariseWatchHistory,
  todayInTaipei,
  watchCinemaOptions,
  watchHallOptions,
  watchPreviewRoute,
  type ManualWatchEntry,
} from './manual-history'
import { useManualWatchHistoryStore } from '../../stores/manual-watch-history'

const { t } = useI18n()
const route = useRoute()
const store = useManualWatchHistoryStore()

interface HistoryForm {
  movieTitle: string
  watchedOn: string
  cinemaKey: string
  customCinema: string
  hallKey: string
  customHall: string
  seatLabel: string
}
const emptyForm = (): HistoryForm => ({
  movieTitle: '',
  watchedOn: todayInTaipei(),
  cinemaKey: '',
  customCinema: '',
  hallKey: '__other__',
  customHall: '',
  seatLabel: '',
})
const form = reactive<HistoryForm>(emptyForm())
const formOpen = ref(false)
const editingId = ref<string | null>(null)
const formError = ref(false)
const saveMessage = ref(false)
const deletingId = ref<string | null>(null)
const query = ref('')
const cinemaFilter = ref('all')
const yearFilter = ref('all')
const cinemaOptions = watchCinemaOptions

const hallOptions = computed(() => watchHallOptions(form.cinemaKey))
const selectedHall = computed(() => hallOptions.value.find((hall) => hall.name === form.hallKey))
const selectedModel = computed(() => {
  const id = selectedHall.value?.modelId
  return id ? findAuditorium(id) : undefined
})
const selectedSeats = computed(() => (selectedModel.value ? createSeats(selectedModel.value) : []))
const seatHasPreview = computed(() =>
  selectedSeats.value.some((seat) => seat.id === form.seatLabel.trim()),
)
const cinemaFilters = computed(() => [
  ...new Map(
    store.entries.map((entry) => [
      entry.cinemaSlug ?? entry.cinemaName,
      { key: entry.cinemaSlug ?? entry.cinemaName, label: entry.cinemaName },
    ]),
  ).values(),
])
const years = computed(() =>
  [...new Set(store.entries.map((entry) => entry.watchedOn.slice(0, 4)))].sort().reverse(),
)
const records = computed(() =>
  filterWatchHistory(store.entries, {
    query: query.value,
    cinema: cinemaFilter.value,
    year: yearFilter.value,
  }),
)
const stats = computed(() => summariseWatchHistory(store.entries))
const footprints = computed(() => groupWatchFootprints(records.value))
const footprintSelection = reactive<Record<string, string>>({})

function currentFootprintSeat(group: SeatFootprintGroup): string {
  const choice = footprintSelection[group.key]
  return choice && group.modelSeats.some((seat) => seat.id === choice)
    ? choice
    : (Object.keys(group.visitedSeatCounts)[0] ?? group.modelSeats[0]?.id ?? '')
}

function selectFootprintSeat(groupKey: string, seatId: string) {
  footprintSelection[groupKey] = seatId
}

function selectedFootprintVisits(group: SeatFootprintGroup) {
  return footstepVisitsForSeat(group, currentFootprintSeat(group))
}

function resetForm() {
  Object.assign(form, emptyForm())
  editingId.value = null
  formError.value = false
}
function openNew() {
  resetForm()
  saveMessage.value = false
  formOpen.value = true
}
function cancelForm() {
  formOpen.value = false
  resetForm()
}
function onCinemaChange() {
  form.hallKey = '__other__'
  form.customHall = ''
  form.seatLabel = ''
}
function onHallChange() {
  form.seatLabel = ''
}
function selectedCinemaName(): string {
  return form.cinemaKey === '__other__'
    ? form.customCinema.trim()
    : (cinemaOptions.find((option) => option.slug === form.cinemaKey)?.name ?? '')
}
function selectedHallName(): string {
  return selectedHall.value?.name ?? form.customHall.trim()
}
function save() {
  formError.value = false
  const cinemaName = selectedCinemaName()
  try {
    const draft = makeManualDraft({
      movieTitle: form.movieTitle,
      watchedOn: form.watchedOn,
      cinemaSlug: form.cinemaKey === '__other__' ? null : form.cinemaKey,
      cinemaName,
      hallName: selectedHallName(),
      seatLabel: form.seatLabel,
      modelId: selectedModel.value?.id ?? null,
      modelVersion: selectedModel.value?.modelVersion ?? null,
      manualEntry: true,
      screeningId: null,
    })
    const success = editingId.value ? store.update(editingId.value, draft) : store.add(draft)
    if (!success) throw new Error('local history save failed')
    cancelForm()
    saveMessage.value = true
  } catch {
    formError.value = true
  }
}

function edit(entry: ManualWatchEntry) {
  resetForm()
  editingId.value = entry.id
  form.movieTitle = entry.movieTitle
  form.watchedOn = entry.watchedOn
  const knownCinema = cinemaOptions.find((option) => option.slug === entry.cinemaSlug)
  form.cinemaKey = knownCinema ? knownCinema.slug : '__other__'
  form.customCinema = knownCinema ? '' : entry.cinemaName
  const knownHall = watchHallOptions(form.cinemaKey).find((hall) => hall.name === entry.hallName)
  form.hallKey = knownHall?.name ?? '__other__'
  form.customHall = knownHall ? '' : entry.hallName
  form.seatLabel = entry.seatLabel
  formOpen.value = true
  saveMessage.value = false
}

function confirmRemove(id: string) {
  if (store.remove(id)) {
    deletingId.value = null
    saveMessage.value = false
  }
}

watch(
  () => [route.query.auditorium, route.query.seat],
  ([modelQuery, seatQuery]) => {
    if (typeof modelQuery !== 'string') return
    const hall = cinemaDirectory.find((entry) => entry.modelId === modelQuery)
    if (!hall) return
    openNew()
    form.cinemaKey = hall.cinemaSlug
    form.hallKey = hall.hallName
    const seats = createSeats(findAuditorium(modelQuery)!)
    form.seatLabel =
      typeof seatQuery === 'string' && seats.some((seat) => seat.id === seatQuery) ? seatQuery : ''
  },
  { immediate: true },
)
</script>

<template>
  <section class="container history-page manual-history">
    <header class="manual-history__heading">
      <div>
        <span class="eyebrow">{{ t('history.eyebrow') }}</span>
        <h1 class="history-page__title">{{ t('history.title') }}</h1>
        <p>{{ t('history.intro') }}</p>
      </div>
      <button class="button-primary manual-history__add" type="button" @click="openNew">
        <v-icon icon="mdi-plus" size="20" />
        {{ t('history.add') }}
      </button>
    </header>

    <p class="manual-history__local-note">
      <v-icon icon="mdi-shield-lock-outline" size="19" />
      {{ t('history.localOnly') }}
    </p>
    <p v-if="store.storageFailure" class="manual-history__error" role="alert">
      {{
        t(
          store.storageFailure === 'invalid'
            ? 'history.invalidStorage'
            : 'history.storageUnavailable',
        )
      }}
    </p>
    <p v-if="saveMessage" class="manual-history__saved" role="status">{{ t('history.saved') }}</p>

    <form v-if="formOpen" class="manual-history__form" @submit.prevent="save">
      <div class="manual-history__form-heading">
        <h2>{{ t(editingId ? 'history.editTitle' : 'history.newTitle') }}</h2>
        <button type="button" class="manual-history__text-button" @click="cancelForm">
          {{ t('history.cancel') }}
        </button>
      </div>
      <div class="manual-history__fields">
        <label class="manual-history__field">
          <span>{{ t('history.movieTitle') }} *</span>
          <input
            v-model="form.movieTitle"
            type="text"
            maxlength="250"
            autocomplete="off"
            :placeholder="t('history.moviePlaceholder')"
            required
          />
        </label>
        <label class="manual-history__field">
          <span>{{ t('history.date') }} *</span>
          <input v-model="form.watchedOn" type="date" required />
        </label>
        <label class="manual-history__field">
          <span>{{ t('history.cinema') }} *</span>
          <select v-model="form.cinemaKey" required @change="onCinemaChange">
            <option value="" disabled>{{ t('history.chooseCinema') }}</option>
            <option v-for="cinema in cinemaOptions" :key="cinema.slug" :value="cinema.slug">
              {{ cinema.name }}
            </option>
            <option value="__other__">{{ t('history.otherCinema') }}</option>
          </select>
        </label>
        <label v-if="form.cinemaKey === '__other__'" class="manual-history__field">
          <span>{{ t('history.customCinema') }} *</span>
          <input
            v-model="form.customCinema"
            type="text"
            maxlength="200"
            required
            :placeholder="t('history.customCinemaPlaceholder')"
          />
        </label>
        <label v-if="form.cinemaKey && hallOptions.length" class="manual-history__field">
          <span>{{ t('history.auditorium') }}</span>
          <select v-model="form.hallKey" @change="onHallChange">
            <option v-for="hall in hallOptions" :key="hall.name" :value="hall.name">
              {{ hall.name }}
            </option>
            <option value="__other__">{{ t('history.otherAuditorium') }}</option>
          </select>
        </label>
        <label
          v-if="form.cinemaKey && (!hallOptions.length || form.hallKey === '__other__')"
          class="manual-history__field"
        >
          <span>{{ t('history.customAuditorium') }}</span>
          <input
            v-model="form.customHall"
            type="text"
            maxlength="160"
            :placeholder="t('history.customAuditoriumPlaceholder')"
          />
        </label>
        <label class="manual-history__field">
          <span>{{ t('history.seat') }}</span>
          <input
            v-model="form.seatLabel"
            type="text"
            maxlength="20"
            autocomplete="off"
            :placeholder="t('history.seatPlaceholder')"
          />
        </label>
      </div>
      <p v-if="selectedModel" class="manual-history__seat-note">
        {{ t(seatHasPreview ? 'history.verifiedSeat' : 'history.modelSeatHelp') }}
        <RouterLink :to="'/auditoriums/' + selectedModel.id">{{
          t('history.openSeatMap')
        }}</RouterLink>
      </p>
      <p v-else class="manual-history__seat-note">{{ t('history.manualSeatHelp') }}</p>
      <p v-if="formError" class="manual-history__error" role="alert">
        {{ t('history.saveError') }}
      </p>
      <div class="manual-history__form-actions">
        <button class="button-primary" type="submit" :disabled="Boolean(store.storageFailure)">
          {{ t(editingId ? 'history.saveChanges' : 'history.save') }}
        </button>
        <button class="manual-history__text-button" type="button" @click="cancelForm">
          {{ t('history.cancel') }}
        </button>
      </div>
    </form>

    <div class="manual-history__stats">
      <div>
        <strong>{{ stats.viewings }}</strong><span>{{ t('history.viewings') }}</span>
      </div>
      <div>
        <strong>{{ stats.films }}</strong><span>{{ t('history.films') }}</span>
      </div>
      <div>
        <strong>{{ stats.cinemas }}</strong><span>{{ t('history.cinemas') }}</span>
      </div>
      <div>
        <strong>{{ stats.seats }}</strong><span>{{ t('history.seats') }}</span>
      </div>
    </div>

    <template v-if="store.entries.length">
      <div class="manual-history__filters">
        <label class="manual-history__field">
          <span>{{ t('history.search') }}</span>
          <input v-model="query" type="search" :placeholder="t('history.searchPlaceholder')" />
        </label>
        <label class="manual-history__field">
          <span>{{ t('history.filterCinema') }}</span>
          <select v-model="cinemaFilter">
            <option value="all">{{ t('history.allCinemas') }}</option>
            <option v-for="cinema in cinemaFilters" :key="cinema.key" :value="cinema.key">
              {{ cinema.label }}
            </option>
          </select>
        </label>
        <label class="manual-history__field">
          <span>{{ t('history.filterYear') }}</span>
          <select v-model="yearFilter">
            <option value="all">{{ t('history.allYears') }}</option>
            <option v-for="year in years" :key="year" :value="year">{{ year }}</option>
          </select>
        </label>
      </div>
      <p class="manual-history__result-count">
        {{ t('history.results', { count: records.length }) }}
      </p>

      <section
        v-if="footprints.length"
        class="manual-history__footprints"
        aria-labelledby="footprints-heading"
      >
        <div class="manual-history__footprints-heading">
          <div>
            <h2 id="footprints-heading">{{ t('history.footprintsTitle') }}</h2>
            <p>{{ t('history.footprintsDescription') }}</p>
          </div>
          <span>{{ t('history.footprintsCount', { count: footprints.length }) }}</span>
        </div>
        <div class="manual-history__footprint-list">
          <article
            v-for="group in footprints"
            :key="group.key"
            class="manual-history__footprint-card"
          >
            <header class="manual-history__footprint-card-heading">
              <div>
                <h3>{{ group.cinemaName }}</h3>
                <p>{{ group.hallName || t('history.unknownHall') }}</p>
              </div>
              <span>{{ t('history.footprintVisits', { count: group.visits.length }) }}</span>
            </header>
            <template v-if="group.model && group.modelSeats.length">
              <p class="manual-history__map-note">{{ t('history.verifiedFootprintMap') }}</p>
              <SeatMap
                :auditorium="group.model"
                :seats="group.modelSeats"
                :selected-seat-id="currentFootprintSeat(group)"
                :visited-seat-counts="group.visitedSeatCounts"
                @select-seat="(seatId) => selectFootprintSeat(group.key, seatId)"
              />
              <div class="manual-history__selected-footprint">
                <div>
                  <strong>{{ currentFootprintSeat(group) }}</strong>
                  <span v-if="selectedFootprintVisits(group).length">
                    {{
                      t('history.seatVisitCount', { count: selectedFootprintVisits(group).length })
                    }}
                  </span>
                  <span v-else>{{ t('history.notVisitedSeat') }}</span>
                </div>
                <RouterLink
                  :to="{
                    path: '/auditoriums/' + group.model.id,
                    query: { seat: currentFootprintSeat(group) },
                  }"
                  class="manual-history__preview-link"
                >
                  <v-icon icon="mdi-eye-outline" size="18" />
                  {{ t('history.previewSeat') }}
                </RouterLink>
              </div>
              <div v-if="selectedFootprintVisits(group).length" class="manual-history__seat-films">
                <span v-for="entry in selectedFootprintVisits(group)" :key="entry.id">
                  {{ entry.movieTitle }} · {{ entry.watchedOn }}
                </span>
              </div>
            </template>
            <div
              v-if="group.textOnlySeats.length || !group.model"
              class="manual-history__text-footprints"
            >
              <p>{{ t(group.model ? 'history.unmappedSeatNotes' : 'history.noSeatMapYet') }}</p>
              <div v-if="group.textOnlySeats.length" class="manual-history__text-seat-list">
                <span v-for="seat in group.textOnlySeats" :key="seat.label">
                  {{ seat.label }}
                  <small>{{ t('history.seatVisitCount', { count: seat.count }) }}</small>
                </span>
              </div>
              <p v-else>{{ t('history.noSeatLabel') }}</p>
            </div>
          </article>
        </div>
      </section>

      <div v-if="records.length" class="manual-history__records">
        <article v-for="entry in records" :key="entry.id" class="manual-history__record">
          <div class="manual-history__record-main">
            <time :datetime="entry.watchedOn">{{ entry.watchedOn }}</time>
            <h2>{{ entry.movieTitle }}</h2>
            <p>
              {{ entry.cinemaName }}
              <span v-if="entry.hallName"> · {{ entry.hallName }}</span>
              <span v-if="entry.seatLabel"> · {{ entry.seatLabel }}</span>
            </p>
            <small>{{ t('history.selfReported') }}</small>
          </div>
          <div class="manual-history__record-actions">
            <RouterLink v-if="watchPreviewRoute(entry)" :to="watchPreviewRoute(entry)!">
              <v-icon icon="mdi-eye-outline" size="17" />
              {{ t('history.previewSeat') }}
            </RouterLink>
            <span v-else-if="entry.seatLabel" class="manual-history__no-preview">
              {{ t('history.noPreview') }}
            </span>
            <button type="button" @click="edit(entry)">{{ t('history.edit') }}</button>
            <button v-if="deletingId !== entry.id" type="button" @click="deletingId = entry.id">
              {{ t('history.delete') }}
            </button>
            <template v-else>
              <button class="manual-history__danger" type="button" @click="confirmRemove(entry.id)">
                {{ t('history.confirmDelete') }}
              </button>
              <button type="button" @click="deletingId = null">{{ t('history.cancel') }}</button>
            </template>
          </div>
        </article>
      </div>
      <p v-else class="manual-history__empty-message">{{ t('history.noMatches') }}</p>
    </template>
    <div v-else class="history-empty manual-history__empty">
      <div class="history-empty__icon" aria-hidden="true">
        <v-icon icon="mdi-ticket-outline" size="38" />
      </div>
      <h2>{{ t('history.emptyTitle') }}</h2>
      <p>{{ t('history.emptyDescription') }}</p>
      <button class="button-primary" type="button" @click="openNew">
        {{ t('history.add') }}
        <v-icon icon="mdi-plus" size="20" />
      </button>
      <RouterLink to="/" class="manual-history__explore">{{ t('history.explore') }}</RouterLink>
    </div>
  </section>
</template>
