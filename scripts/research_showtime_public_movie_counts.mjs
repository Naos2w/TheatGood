/* global document */
/**
 * Read-only, anonymous Showtime public film-card count by official cinema selector.
 * The cards are NOT halls and the data does not establish permanent hall inventory.
 * Does not enter a screening, open a seat preview, sign in, or use member Chrome.
 *
 * Usage: node scripts/research_showtime_public_movie_counts.mjs [venue-slugs...]
 */
import assert from 'node:assert/strict'
import console from 'node:console'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { URL } from 'node:url'
import { chromium } from 'playwright-core'

const VENUES = new Map([
  ['showtime-taipei-dome', '大巨蛋秀泰影城'],
  ['showtime-taipei-xinxin', '台北欣欣秀泰影城'],
  ['showtime-tucheng', '土城秀泰影城'],
  ['showtime-shulin', '樹林秀泰影城'],
  ['showtime-taichung-station', '台中站前秀泰影城'],
  ['showtime-taichung-wenxin', '台中文心秀泰影城'],
  ['showtime-taichung-lipao', '台中麗寶秀泰影城'],
  ['showtime-chiayi', '嘉義秀泰影城'],
  ['showtime-keelung', '基隆秀泰影城'],
  ['showtime-hualien', '花蓮秀泰影城'],
  ['showtime-taitung', '台東秀泰影城'],
  ['showtime-yunlin-beigang', '北港秀泰影城'],
  ['showtime-tainan-rende', '台南仁德秀泰影城'],
  ['showtime-kaohsiung-gangshan', '高雄岡山秀泰影城'],
  ['showtime-kaohsiung-dreammall', '高雄夢時代秀泰影城'],
])

const census = JSON.parse(
  fs.readFileSync(
    new URL('./showtime-chrome-extension/operator-public-hall-census.json', import.meta.url),
    'utf8',
  ),
)
const requested = process.argv.slice(2)
const ids = requested.length ? requested : [...VENUES.keys()]
assert(new Set(ids).size === ids.length, 'Duplicate venue')
assert(ids.length <= 15, 'Too many venues')
assert(
  ids.every((id) => VENUES.has(id) && census.venues[id]),
  'Non-allowlisted venue',
)

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'theatgood-public-count-'))
let browser
const results = []
try {
  browser = await chromium.launchPersistentContext(profile, {
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    chromiumSandbox: true,
    locale: 'zh-TW',
    viewport: { width: 1280, height: 840 },
    args: ['--no-first-run', '--no-default-browser-check'],
  })
  const page = browser.pages()[0] ?? (await browser.newPage())
  for (const id of ids) {
    try {
      await page.goto('https://www.showtimes.com.tw/', {
        waitUntil: 'domcontentloaded',
        timeout: 25000,
      })
      await page.getByRole('link', { name: '快速訂票' }).click({ timeout: 12000 })
      await page.getByRole('button', { name: VENUES.get(id), exact: true }).click({
        timeout: 12000,
      })
      await page.getByText('立即訂票', { exact: true }).first().waitFor({ timeout: 12000 })
      const movieCards = await page.evaluate(
        () =>
          [...document.querySelectorAll('div.group.cursor-pointer')].filter((node) =>
            node.textContent?.includes('立即訂票'),
          ).length,
      )
      results.push({ cinemaSlug: id, publicMovieCards: movieCards, status: 'observed' })
    } catch (error) {
      results.push({
        cinemaSlug: id,
        status: 'public-page-unavailable',
        error: String(error?.message ?? error)
          .split('\n')[0]
          .slice(0, 120),
      })
    }
    console.log(JSON.stringify(results.at(-1)))
  }
} finally {
  if (browser) await browser.close()
  fs.rmSync(profile, { recursive: true, force: true, maxRetries: 2 })
}
console.log(
  JSON.stringify({
    observedAt: new Date().toISOString(),
    publicOnly: true,
    cookieOrMembershipRead: false,
    seatPreviewOpened: false,
    bookingActions: false,
    requestedVenues: ids.length,
    successes: results.filter((row) => row.status === 'observed').length,
  }),
)
