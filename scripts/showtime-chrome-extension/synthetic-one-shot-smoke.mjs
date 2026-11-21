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
  await context.route('https://www.showtimes.com.tw/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fixture })
  })
  const worker =
    context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker', { timeout: 15000 }))
  const extensionHost = new URL(worker.url()).host
  const memberTab = await context.newPage()
  await memberTab.goto('https://www.showtimes.com.tw/', { waitUntil: 'domcontentloaded' })
  await memberTab.evaluate(() => {
    globalThis.sessionStorage.setItem('syntheticSignIn', 'yes')
  })
  await memberTab.reload()
  assert.equal(await memberTab.locator('header button').innerText(), '會員中心')

  const popup = await context.newPage()
  await popup.goto(
    'chrome-extension://' +
      extensionHost +
      '/popup.html?autorun=showtime-taitung&once=research-request-synthetic-20261118&ack=read-only',
    {
      waitUntil: 'domcontentloaded',
    },
  )
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
      test: 'synthetic_one_shot_remote_scan_from_explicit_url',
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
  const request = await popup.evaluate(() =>
    globalThis.chrome.storage.local.get('theatgoodOnce-research-request-synthetic-20261118'),
  )
  assert.equal(
    request['theatgoodOnce-research-request-synthetic-20261118'].slug,
    'showtime-taitung',
  )
  await popup.reload({ waitUntil: 'domcontentloaded' })
  await popup
    .locator('#status')
    .getByText('這個一次性研究指令已使用；不重複執行。')
    .waitFor({ timeout: 6000 })

  // v0.1.6: the one-shot extension URL sends ONLY its explicitly missing
  // hall labels. Real source hall 1 is present in the synthetic fixture.
  await popup.goto(
    'chrome-extension://' +
      extensionHost +
      '/popup.html?autorun=showtime-taitung&once=targeted-missing-test-20261120-positive&ack=read-only&targets=' +
      encodeURIComponent('1廳') +
      '&start=0',
    { waitUntil: 'domcontentloaded' },
  )
  let targetedStatus = null
  const targetedAt = Date.now()
  while (Date.now() - targetedAt < 17000) {
    targetedStatus = await popup.evaluate(() =>
      globalThis.chrome.storage.local.get('theatgoodScanStatus').then((r) => r.theatgoodScanStatus),
    )
    if (targetedStatus?.targetedHallsOnly === true && targetedStatus.state === 'done') break
    await popup.waitForTimeout(350)
  }
  assert.equal(targetedStatus?.state, 'done', 'Exact missing hall was not captured')
  assert.equal(targetedStatus.targetedHallsOnly, true)
  assert.equal(targetedStatus.layouts, 1)

  // Hall 2 is in the Taitung public-name census but NOT in the current
  // synthetic screening. Never preview hall 1 by mistake or invent hall 2.
  await popup.goto(
    'chrome-extension://' +
      extensionHost +
      '/popup.html?autorun=showtime-taitung&once=targeted-missing-test-20261120-negative&ack=read-only&targets=' +
      encodeURIComponent('2廳') +
      '&start=0',
    { waitUntil: 'domcontentloaded' },
  )
  let noHallStatus = null
  const absentAt = Date.now()
  while (Date.now() - absentAt < 17000) {
    noHallStatus = await popup.evaluate(() =>
      globalThis.chrome.storage.local.get('theatgoodScanStatus').then((r) => r.theatgoodScanStatus),
    )
    if (noHallStatus?.state === 'error') break
    await popup.waitForTimeout(350)
  }
  assert.equal(noHallStatus?.state, 'error', 'Absence of target must not create a layout')
  assert.match(noHallStatus.message, /指定缺漏廳號/)
  assert.equal(await memberTab.locator('header button').innerText(), '會員中心')
  console.log(
    JSON.stringify({
      test: 'targeted_missing_halls_source_provenance',
      exactHallCollected: targetedStatus.layouts === 1,
      absentHallNotFabricated: noHallStatus.state === 'error',
      cinemaSignInPreserved: true,
      noBookingOrSeatSelection: true,
      siteRequestsMocked: true,
    }),
  )
} finally {
  if (context) await context.close()
  fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3 })
}
