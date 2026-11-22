<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { usePreferences, type AppLocale, type ThemePreference } from './composables/usePreferences'
import { chainCinemas } from './features/cinemas/chain-directory'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const { themePreference, appLocale } = usePreferences()
const settingsOpen = ref(false)
const isViewer = computed(() =>
  ['viewer', 'vieshow-3d-preview', 'miranew-3d-pattern'].includes(String(route.name)),
)
const isImmersiveViewer = computed(() => isViewer.value && route.query.view === '3d')
const isHome = computed(() => route.name === 'home')
const isCinemaRoute = computed(() => !['history', 'screenings'].includes(String(route.name)))
// Page motion is scoped to the two top-level tabs. Detail/seat routes keep
// their existing navigation so a swipe never hijacks a seat map or 3D gesture.
const primaryPageSlide = ref('')
watch(
  () => route.name,
  (next, previous) => {
    if (previous === 'home' && next === 'history') primaryPageSlide.value = 'primary-slide-left'
    else if (previous === 'history' && next === 'home')
      primaryPageSlide.value = 'primary-slide-right'
    else primaryPageSlide.value = ''
  },
  { flush: 'sync' },
)
let pageSwipeStart: { x: number; y: number; at: number; page: 'home' | 'history' } | null = null
function beginPageSwipe(event: TouchEvent) {
  pageSwipeStart = null
  if (window.innerWidth >= 600 || settingsOpen.value || event.touches.length !== 1) return
  const current = route.name
  if (current !== 'home' && current !== 'history') return
  const target = event.target
  if (!(target instanceof Element)) return
  if (
    target.closest(
      'a, button, input, textarea, select, [role="button"], [role="slider"], [data-no-page-swipe], .seat-references__scroll, .seat-map__viewport',
    )
  )
    return
  // Preserve Safari's system edge-swipe-to-go-back gesture.
  const touch = event.touches[0]!
  if (touch.clientX < 64 || touch.clientX > window.innerWidth - 28) return
  for (
    let ancestor = target.parentElement;
    ancestor && ancestor !== event.currentTarget;
    ancestor = ancestor.parentElement
  ) {
    const style = getComputedStyle(ancestor)
    if (
      (style.overflowX === 'auto' || style.overflowX === 'scroll') &&
      ancestor.scrollWidth > ancestor.clientWidth + 4
    )
      return
  }
  pageSwipeStart = {
    x: touch.clientX,
    y: touch.clientY,
    at: performance.now(),
    page: current,
  }
}
function finishPageSwipe(event: TouchEvent) {
  const start = pageSwipeStart
  pageSwipeStart = null
  if (!start || event.changedTouches.length !== 1 || event.touches.length) return
  if (start.page !== route.name || performance.now() - start.at > 1100) return
  const touch = event.changedTouches[0]!
  const dx = touch.clientX - start.x
  const dy = touch.clientY - start.y
  if (Math.abs(dx) < 88 || Math.abs(dx) < Math.abs(dy) * 1.65 || Math.abs(dy) > 75) return
  if (start.page === 'home' && dx < 0) void router.push('/history')
  if (start.page === 'history' && dx > 0) void router.push('/')
}
function cancelPageSwipe() {
  pageSwipeStart = null
}
const mobileHeaderTitle = computed(() => {
  if (isHome.value) return 'TheatGood'
  if (route.name === 'history') return t('app.history')
  if (route.name === 'screenings') return t('app.screenings')
  if (route.name === 'source-3d-explorer')
    return appLocale.value.startsWith('en') ? '3D auditorium explorer' : '3D 影廳圖鑑'
  if (route.name === 'chain-cinema') {
    return (
      chainCinemas.find((cinema) => cinema.slug === route.params.slug)?.name ?? t('home.viewCinema')
    )
  }
  if (route.name === 'directory-detail') return t('home.viewCinema')
  if (isViewer.value) return t('ux.chooseSeat')
  return 'TheatGood'
})
const headerHidden = ref(false)
let scrollAnchorY = 0

function updateHeaderOnScroll() {
  const y = Math.max(0, window.scrollY)
  if (y <= 35 || settingsOpen.value) {
    headerHidden.value = false
    scrollAnchorY = y
    return
  }
  // An accumulated threshold avoids flicker from 1px touch/scroll deltas.
  if (Math.abs(y - scrollAnchorY) < 14) return
  if (y > scrollAnchorY && y > 100) headerHidden.value = true
  if (y < scrollAnchorY) headerHidden.value = false
  scrollAnchorY = y
}

function returnFromHeader() {
  settingsOpen.value = false
  headerHidden.value = false
  // Prefer the real browser stack, but provide a safe target for direct links.
  const back = window.history.state?.back
  if (typeof back === 'string' && back.startsWith('/')) {
    router.back()
    return
  }
  if (route.name === 'miranew-3d-pattern') {
    void router.push('/cinemas/' + String(route.params.slug))
    return
  }
  if (route.name === 'vieshow-3d-preview') {
    void router.push({
      path: '/cinemas/' + String(route.params.slug),
      hash: '#vieshow-seat-references',
    })
    return
  }
  void router.push('/')
}

watch(
  () => route.fullPath,
  () => {
    settingsOpen.value = false
    headerHidden.value = false
    scrollAnchorY = 0
  },
)
watch(settingsOpen, (isOpen) => {
  if (isOpen) headerHidden.value = false
})

function chooseTheme(value: ThemePreference) {
  themePreference.value = value
}

function chooseLocale(value: AppLocale) {
  appLocale.value = value
}

function updateGlassGlint(event: PointerEvent) {
  if (!(event.currentTarget instanceof HTMLElement)) return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const surface = event.currentTarget
  const rect = surface.getBoundingClientRect()
  if (!rect.width || !rect.height) return
  const x = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100))
  const y = Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100))
  surface.style.setProperty('--liquid-x', x.toFixed(1) + '%')
  surface.style.setProperty('--liquid-y', y.toFixed(1) + '%')
}
function clearGlassGlint(event: PointerEvent) {
  if (!(event.currentTarget instanceof HTMLElement)) return
  event.currentTarget.style.removeProperty('--liquid-x')
  event.currentTarget.style.removeProperty('--liquid-y')
}

// Adapted from Go Travel develop's continuous dock scrubbing. Unlike a
// tap-only CSS animation, the shared lens follows the finger between tabs.
const dockDragOffsetPx = ref<number | null>(null)
let dockPointer: { id: number; startX: number; moved: boolean; slot: number } | null = null
let lastDockScrubEnd = -Infinity

function beginDockScrub(event: PointerEvent) {
  updateGlassGlint(event)
  if (event.button !== 0) return
  dockPointer = { id: event.pointerId, startX: event.clientX, moved: false, slot: 0 }
}

function moveDockScrub(event: PointerEvent) {
  updateGlassGlint(event)
  const pointer = dockPointer
  if (!pointer || pointer.id !== event.pointerId) return
  if (!pointer.moved) {
    if (Math.abs(event.clientX - pointer.startX) <= 4) return
    pointer.moved = true
    try {
      if (event.currentTarget instanceof HTMLElement) {
        event.currentTarget.setPointerCapture(event.pointerId)
      }
    } catch {
      // Pointer capture is unavailable in some browser/test environments.
    }
  }
  const nav = event.currentTarget
  if (!(nav instanceof HTMLElement)) return
  const links = nav.querySelectorAll<HTMLElement>('.glass-tabbar__link')
  if (links.length !== 2) return
  const first = links[0]!.getBoundingClientRect()
  const second = links[1]!.getBoundingClientRect()
  const start = first.left + first.width / 2
  const distance = second.left + second.width / 2 - start
  if (distance <= 0) return
  pointer.slot = Math.max(0, Math.min(1, (event.clientX - start) / distance))
  dockDragOffsetPx.value = pointer.slot * distance
  if (event.cancelable) event.preventDefault()
}

function finishDockScrub(event: PointerEvent) {
  const pointer = dockPointer
  if (!pointer || pointer.id !== event.pointerId) return
  dockPointer = null
  if (!pointer.moved) return
  try {
    if (
      event.currentTarget instanceof HTMLElement &&
      event.currentTarget.hasPointerCapture(event.pointerId)
    ) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  } catch {
    // Pointer capture may already have been released by the browser.
  }
  lastDockScrubEnd = performance.now()
  const target = pointer.slot >= 0.5 ? '/history' : '/'
  // The route takes over positioning as the inline drag offset is cleared.
  void router.push(target).finally(() => {
    dockDragOffsetPx.value = null
  })
}

function cancelDockScrub(event: PointerEvent) {
  if (dockPointer?.id !== event.pointerId) return
  dockPointer = null
  dockDragOffsetPx.value = null
}

function suppressDockClickAfterScrub(event: MouseEvent) {
  if (performance.now() - lastDockScrubEnd < 300) event.preventDefault()
}

function handleOutsidePointer(event: PointerEvent) {
  if (
    settingsOpen.value &&
    event.target instanceof Element &&
    !event.target.closest('.settings-anchor')
  ) {
    settingsOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', handleOutsidePointer)
  window.addEventListener('scroll', updateHeaderOnScroll, { passive: true })
  scrollAnchorY = Math.max(0, window.scrollY)
})
onUnmounted(() => {
  document.removeEventListener('pointerdown', handleOutsidePointer)
  window.removeEventListener('scroll', updateHeaderOnScroll)
})
</script>

<template>
  <v-app class="theatgood-app">
    <!-- Optional SVG edge-displacement lens for browsers supporting filtered backdrops.
         No filter is applied to text or icons; CSS retains a readable fallback. -->
    <svg
      aria-hidden="true"
      focusable="false"
      class="tg-refraction-defs"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <filter
          id="tg-glass-edge-refraction"
          x="-12%"
          y="-12%"
          width="124%"
          height="124%"
          color-interpolation-filters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.011 0.019"
            numOctaves="1"
            seed="9"
            result="flow"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="flow"
            scale="5"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
    <div class="app-shell" :class="{ 'app-shell--viewer': isViewer }">
      <header
        v-if="!isImmersiveViewer"
        class="site-header"
        :class="{
          'is-scroll-hidden': headerHidden && !settingsOpen,
          'site-header--detail': !isHome,
          'site-header--viewer': isViewer,
        }"
      >
        <div
          class="site-header__inner"
          @pointermove="updateGlassGlint"
          @pointerdown="updateGlassGlint"
          @pointerleave="clearGlassGlint"
        >
          <button
            v-if="!isHome"
            class="site-header__back"
            type="button"
            :aria-label="t('app.back')"
            :title="t('app.back')"
            @click="returnFromHeader"
          >
            <v-icon icon="mdi-chevron-left" size="30" />
          </button>
          <span v-else class="site-header__placeholder" aria-hidden="true" />
          <RouterLink class="brand" to="/" :aria-label="t('app.appName')">
            <span class="brand__mark" aria-hidden="true" />
            <span class="brand__name brand__name--desktop">TheatGood</span>
            <span class="brand__name brand__name--mobile">{{ mobileHeaderTitle }}</span>
          </RouterLink>

          <nav class="site-nav" :aria-label="t('app.mainNav')">
            <RouterLink to="/" class="site-nav__link" :class="{ 'is-active': isCinemaRoute }">
              {{ t('app.home') }}
            </RouterLink>
            <RouterLink to="/history" class="site-nav__link">
              {{ t('app.history') }}
            </RouterLink>
          </nav>

          <div class="settings-anchor">
            <button
              class="icon-button glass-control"
              type="button"
              :aria-label="t('app.settings')"
              :aria-expanded="settingsOpen"
              aria-controls="theatgood-preferences"
              @click="settingsOpen = !settingsOpen"
            >
              <v-icon icon="mdi-cog-outline" size="25" />
            </button>

            <div
              v-if="settingsOpen"
              id="theatgood-preferences"
              class="settings-popover glass-panel"
              role="group"
              :aria-label="t('app.settings')"
              @keydown.esc="settingsOpen = false"
            >
              <div class="settings-popover__heading">
                <strong>{{ t('app.settings') }}</strong>
                <button
                  class="icon-button icon-button--small"
                  type="button"
                  :aria-label="t('app.close')"
                  @click="settingsOpen = false"
                >
                  <v-icon icon="mdi-close" size="18" />
                </button>
              </div>

              <div class="settings-popover__field">
                <span class="field-label">{{ t('app.appearance') }}</span>
                <div class="segmented-control" role="group" :aria-label="t('app.appearance')">
                  <button
                    type="button"
                    :aria-pressed="themePreference === 'system'"
                    :class="{ active: themePreference === 'system' }"
                    @click="chooseTheme('system')"
                  >
                    <v-icon icon="mdi-laptop" size="17" />
                    {{ t('app.system') }}
                  </button>
                  <button
                    type="button"
                    :aria-pressed="themePreference === 'light'"
                    :class="{ active: themePreference === 'light' }"
                    @click="chooseTheme('light')"
                  >
                    <v-icon icon="mdi-white-balance-sunny" size="17" />
                    {{ t('app.light') }}
                  </button>
                  <button
                    type="button"
                    :aria-pressed="themePreference === 'dark'"
                    :class="{ active: themePreference === 'dark' }"
                    @click="chooseTheme('dark')"
                  >
                    <v-icon icon="mdi-weather-night" size="17" />
                    {{ t('app.dark') }}
                  </button>
                </div>
              </div>

              <div class="settings-popover__field">
                <span class="field-label">{{ t('app.language') }}</span>
                <div class="segmented-control" role="group" :aria-label="t('app.language')">
                  <button
                    type="button"
                    :aria-pressed="appLocale === 'zh-TW'"
                    :class="{ active: appLocale === 'zh-TW' }"
                    @click="chooseLocale('zh-TW')"
                  >
                    繁體中文
                  </button>
                  <button
                    type="button"
                    :aria-pressed="appLocale === 'en-GB'"
                    :class="{ active: appLocale === 'en-GB' }"
                    @click="chooseLocale('en-GB')"
                  >
                    English
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main
        class="app-main"
        :class="{ 'app-main--viewer': isViewer }"
        @touchstart.passive="beginPageSwipe"
        @touchend.passive="finishPageSwipe"
        @touchcancel.passive="cancelPageSwipe"
      >
        <RouterView v-slot="{ Component, route: viewRoute }">
          <Transition :name="primaryPageSlide" mode="out-in">
            <component :is="Component" :key="viewRoute.name ?? viewRoute.path" />
          </Transition>
        </RouterView>
      </main>

      <nav
        v-if="!isViewer"
        class="glass-tabbar glass-panel"
        :class="{
          'is-history': route.name === 'history',
          'is-scrubbing': dockDragOffsetPx !== null,
        }"
        :aria-label="t('app.mainNav')"
        @pointermove="moveDockScrub"
        @pointerdown="beginDockScrub"
        @pointerup="finishDockScrub"
        @pointercancel="cancelDockScrub"
        @pointerleave="clearGlassGlint"
      >
        <span
          class="glass-tabbar__lens"
          aria-hidden="true"
          :style="
            dockDragOffsetPx === null
              ? undefined
              : { transform: `translate3d(${dockDragOffsetPx}px, 0, 0) scale(1.05)` }
          "
        />
        <RouterLink
          to="/"
          draggable="false"
          class="glass-tabbar__link"
          :aria-label="t('app.home')"
          :class="{ 'is-active': isCinemaRoute }"
          :aria-current="isCinemaRoute ? 'page' : undefined"
          @click.capture="suppressDockClickAfterScrub"
        >
          <v-icon icon="mdi-magnify" size="28" />
          <span class="glass-tabbar__label">{{ t('app.home') }}</span>
        </RouterLink>
        <RouterLink
          to="/history"
          draggable="false"
          class="glass-tabbar__link"
          :aria-label="t('app.history')"
          :class="{ 'is-active': route.name === 'history' }"
          :aria-current="route.name === 'history' ? 'page' : undefined"
          @click.capture="suppressDockClickAfterScrub"
        >
          <v-icon
            :icon="route.name === 'history' ? 'mdi-ticket' : 'mdi-ticket-outline'"
            size="28"
          />
          <span class="glass-tabbar__label">{{ t('app.history') }}</span>
        </RouterLink>
      </nav>
    </div>
  </v-app>
</template>
