import { computed, ref, watch } from 'vue'
import { i18n } from '../i18n'

export type ThemePreference = 'system' | 'light' | 'dark'
export type AppLocale = 'zh-TW' | 'en-GB'

function stored(key: string): string | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function remember(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Private browsing may disable storage; in-session preferences still work.
  }
}

function initialLocale(): AppLocale {
  const saved = stored('theatgood-locale')
  if (saved === 'zh-TW' || saved === 'en-GB') return saved
  return typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('en')
    ? 'en-GB'
    : 'zh-TW'
}

const initialTheme = stored('theatgood-theme')
export const themePreference = ref<ThemePreference>(
  initialTheme === 'light' || initialTheme === 'dark' ? initialTheme : 'system',
)
export const appLocale = ref<AppLocale>(initialLocale())

const darkQuery =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null
const systemDark = ref(darkQuery?.matches ?? false)
if (darkQuery) {
  darkQuery.addEventListener('change', (event) => {
    systemDark.value = event.matches
  })
}

export const resolvedTheme = computed<'light' | 'dark'>(() =>
  themePreference.value === 'system'
    ? systemDark.value
      ? 'dark'
      : 'light'
    : themePreference.value,
)

watch(
  resolvedTheme,
  (theme) => {
    if (typeof document === 'undefined') return
    document.documentElement.dataset.theme = theme
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#0b0d13' : '#ffffff')
  },
  { immediate: true },
)

watch(themePreference, (value) => remember('theatgood-theme', value))
watch(
  appLocale,
  (value) => {
    i18n.global.locale.value = value
    if (typeof document !== 'undefined') {
      document.documentElement.lang = value
    }
    remember('theatgood-locale', value)
  },
  { immediate: true },
)

export function usePreferences() {
  return { themePreference, resolvedTheme, appLocale }
}
