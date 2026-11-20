import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [vue(), vuetify({ autoImport: true })],
  // Allow only this device's private Tailscale DNS name on the UAT preview.
  preview: { allowedHosts: ['msi-win.tailcca2df.ts.net'] },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'db/**/*.test.ts'],
  },
})
