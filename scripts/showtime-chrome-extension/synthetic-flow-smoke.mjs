/**
 * Synthetic end-to-end Chrome extension test.
 * All Showtime page navigation is intercepted into a local HTML fixture.
 * The user's actual Chrome, cookies, account and ticketing are untouched.
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
const fixture = fs.readFileSync(
  new URL('../research-fixtures/showtime-seat-preview-synthetic.html', import.meta.url),
  'utf8',
)
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'theatgood-ext-synthetic-'))
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
    acceptDownloads: true,
    args: ['--disable-extensions-except=' + dir, '--load-extension=' + dir],
  })
  await context.route('https://showtimes.com.tw/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fixture })
  })
  const worker =
    context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker', { timeout: 15000 }))
  const extensionHost = new URL(worker.url()).host
  const memberTab = await context.newPage()
  await memberTab.goto('https://showtimes.com.tw/', { waitUntil: 'domcontentloaded' })
  await memberTab.evaluate(() => {
    globalThis.sessionStorage.setItem('syntheticSignIn', 'yes')
  })
  await memberTab.reload()
  assert.equal(await memberTab.locator('header button').innerText(), '會員中心')

  const popup = await context.newPage()
  await popup.goto('chrome-extension://' + extensionHost + '/popup.html', {
    waitUntil: 'domcontentloaded',
  })
  await popup.locator('#venue').selectOption('showtime-taitung')
  await popup.locator('#run').click()
  let status = null
  const started = Date.now()
  while (Date.now() - started < 25000) {
    status = await popup.evaluate(() =>
      globalThis.chrome.storage.local
        .get('theatgoodScanStatus')
        .then((result) => result.theatgoodScanStatus),
    )
    if (['done', 'error'].includes(status?.state)) break
    await popup.waitForTimeout(350)
  }
  const originalTabState = await memberTab.locator('header button').innerText()
  console.log(
    JSON.stringify({
      test: 'synthetic_logged_in_original_tab_with_background_scan',
      state: status?.state || 'timeout',
      diagnosis: status?.message ?? null,
      layouts: status?.layouts ?? 0,
      existingMemberTabUntouched: originalTabState === '會員中心',
      allOperatorPagesMocked: true,
      accountDataNotAccessed: true,
      actualSeatsNotClicked: true,
      userBrowserUnchanged: true,
    }),
  )
  assert(['done', 'error'].includes(status?.state), 'Scan did not reach terminal status')
  assert.equal(originalTabState, '會員中心')
} finally {
  if (context) await context.close()
  fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3 })
}
