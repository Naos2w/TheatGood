import { createApp, watch } from 'vue'
import { createPinia } from 'pinia'
import { createVuetify } from 'vuetify'
import { mdi } from 'vuetify/iconsets/mdi'
import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import './style.css'
import './liquid-glass-material.css'
import './seat-selection-ux.css'
import App from './App.vue'
import router from './router'
import { i18n } from './i18n'
import { resolvedTheme } from './composables/usePreferences'

const vuetify = createVuetify({
  icons: { defaultSet: 'mdi', sets: { mdi } },
  theme: {
    defaultTheme: resolvedTheme.value === 'dark' ? 'theatgoodDark' : 'theatgoodLight',
    themes: {
      theatgoodLight: {
        dark: false,
        colors: {
          background: '#f5f6f9',
          surface: '#ffffff',
          primary: '#bd8b56',
          secondary: '#778ca7',
        },
      },
      theatgoodDark: {
        dark: true,
        colors: {
          background: '#131720',
          surface: '#242833',
          primary: '#e5bc8a',
          secondary: '#a9b7cc',
        },
      },
    },
  },
})

watch(resolvedTheme, (theme) => {
  vuetify.theme.global.name.value = theme === 'dark' ? 'theatgoodDark' : 'theatgoodLight'
})

createApp(App).use(createPinia()).use(router).use(i18n).use(vuetify).mount('#app')
