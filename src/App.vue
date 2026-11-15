<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { usePreferences, type AppLocale, type ThemePreference } from './composables/usePreferences'

const route = useRoute()
const { t } = useI18n()
const { themePreference, appLocale } = usePreferences()
const settingsOpen = ref(false)
const isViewer = computed(() => route.name === 'viewer')

watch(
  () => route.fullPath,
  () => {
    settingsOpen.value = false
  },
)

function chooseTheme(value: ThemePreference) {
  themePreference.value = value
}

function chooseLocale(value: AppLocale) {
  appLocale.value = value
}
</script>

<template>
  <v-app class="theatgood-app">
    <div class="app-shell" :class="{ 'app-shell--viewer': isViewer }">
      <header v-if="!isViewer" class="site-header">
        <div class="site-header__inner">
          <RouterLink class="brand" to="/" :aria-label="t('app.appName')">
            <span class="brand__mark" aria-hidden="true" />
            <span class="brand__name">TheatGood</span>
          </RouterLink>

          <nav class="site-nav" :aria-label="t('app.mainNav')">
            <RouterLink to="/" class="site-nav__link">
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
              <v-icon icon="mdi-tune-variant" size="20" />
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

      <main class="app-main" :class="{ 'app-main--viewer': isViewer }">
        <RouterView />
      </main>

      <nav v-if="!isViewer" class="glass-tabbar glass-panel" :aria-label="t('app.mainNav')">
        <RouterLink
          to="/"
          class="glass-tabbar__link"
          :class="{ 'is-active': route.name === 'home' }"
        >
          <v-icon icon="mdi-magnify" size="23" />
          <span>{{ t('app.home') }}</span>
        </RouterLink>
        <RouterLink
          to="/history"
          class="glass-tabbar__link"
          :class="{ 'is-active': route.name === 'history' }"
        >
          <v-icon icon="mdi-ticket-outline" size="23" />
          <span>{{ t('app.history') }}</span>
        </RouterLink>
      </nav>
    </div>
  </v-app>
</template>
