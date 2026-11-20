/**
 * Zero-account isolated extension integration test.
 * Uses a disposable Chromium profile and the public Showtimes homepage.
 * One test request only, no user login, no seat selection, no booking.
 * The user’s existing signed-in Chrome is neither attached nor modified.
 */
import assert from 'node:assert/strict'
import console from 'node:console'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { URL, fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const dir = path.dirname(fileURLToPath(import.meta.url))
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'theatgood-ext-diagnostic-'))
let context
try {
  context = await chromium.launchPersistentContext(profile, {
    executablePath: path.join(
      process.env.LOCALAPPDATA,
      'ms-playwright',
      'chromium-1243',
      'chrome-win64',
      'chrome.exe',
    ),
    headless: true,
    chromiumSandbox: true,
    args: ['--disable-extensions-except=' + dir, '--load-extension=' + dir],
  })
  const sw =
    context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker', { timeout: 17000 }))
  const url = new URL(sw.url())
  assert.equal(url.protocol, 'chrome-extension:')
  const page = await context.newPage()
  await page.goto('chrome-extension://' + url.host + '/popup.html', {
    waitUntil: 'domcontentloaded',
  })
  await page.locator('#venue').selectOption('showtime-taitung')
  await page.locator('#run').click()
  let status = null
  const started = Date.now()
  while (Date.now() - started < 30000) {
    status = await page.evaluate(() =>
      globalThis.chrome.storage.local.get('theatgoodScanStatus').then((r) => r.theatgoodScanStatus),
    )
    if (status?.state === 'error' || status?.state === 'done') break
    await page.waitForTimeout(350)
  }
  console.log(
    JSON.stringify({
      test: 'unauthenticated_isolated_extension_one_request',
      completed: ['error', 'done'].includes(status?.state),
      state: status?.state,
      message: status?.message ?? null,
      seatLayouts: status?.layouts ?? 0,
      accountAccess: false,
      bookingActions: false,
      signedInUserChromeUntouched: true,
    }),
  )
  assert(
    status?.state === 'error' || status?.state === 'done',
    'No terminal status from service worker',
  )
  assert.equal(status?.state, 'error', 'No login must not return a seat-scraping success')
} finally {
  if (context) await context.close()
  fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3 })
}
