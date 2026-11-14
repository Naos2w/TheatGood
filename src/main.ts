import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createVuetify } from 'vuetify'
import { mdi } from 'vuetify/iconsets/mdi'
import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import './style.css'
import App from './App.vue'
import router from './router'

const vuetify = createVuetify({
  icons: { defaultSet: 'mdi', sets: { mdi } },
  theme: {
    defaultTheme: 'theatgood',
    themes: {
      theatgood: {
        dark: true,
        colors: {
          background: '#090c15',
          surface: '#141a2a',
          primary: '#c7a77b',
          secondary: '#9ea9c5',
        },
      },
    },
  },
})

createApp(App).use(createPinia()).use(router).use(vuetify).mount('#app')
