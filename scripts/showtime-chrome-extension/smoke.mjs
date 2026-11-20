/**
 * Isolated smoke test: loads only the extension popup in a fresh TEMP Chrome
 * profile. It does not read/authenticate the user's Showtime account, does
 * not click scan, and cannot touch the currently signed-in Chrome.
 */
import assert from 'node:assert/strict'
import console from 'node:console'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { URL, fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
const extensionDir = path.dirname(fileURLToPath(import.meta.url))
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'theatgood-ext-smoke-'))
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
    args: ['--disable-extensions-except=' + extensionDir, '--load-extension=' + extensionDir],
  })
  const sw =
    context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker', { timeout: 15000 }))
  const id = new URL(sw.url()).host
  assert(/^[a-p]{32}$/.test(id))
  const page = await context.newPage()
  await page.goto('chrome-extension://' + id + '/popup.html', { waitUntil: 'domcontentloaded' })
  await page.locator('#venue option').first().waitFor({ state: 'attached', timeout: 8000 })
  const options = await page.locator('#venue option').count()
  const button = await page.locator('#run').innerText()
  assert.equal(options, 15)
  assert.equal(await page.locator('#version').innerText(), 'v0.1.5')
  assert.match(button, /座位預覽/)
  console.log(
    JSON.stringify({
      isolatedProfile: true,
      extensionLoaded: true,
      options,
      scanNotStarted: true,
      signedInBrowserUntouched: true,
    }),
  )
} finally {
  if (context) await context.close()
  fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3 })
}
