/* global document */
/**
 * Read ONLY public Showtimes screening-card cinema + hall labels.
 * Does not enter seat previews, select a seat, open checkout, read credentials,
 * use the member Chrome profile, or bypass any login/security verification.
 *
 * Usage:
 *   node scripts/research_showtime_public_missing_hall_screenings.mjs showtime-taipei-xinxin 0
 * One venue, at most eight public film cards per run.
 */
import assert from 'node:assert/strict'
import console from 'node:console'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { URL, fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { auditShowtimeCoverage } from './research_showtime_coverage_gaps.mjs'

const repo = fileURLToPath(new URL('../', import.meta.url))
const research = path.join(repo, 'docs/research/theatgood-2026-11-18')
const downloads = path.join(os.homedir(), 'Downloads', 'TheatGood')
const census = JSON.parse(
  fs.readFileSync(
    path.join(repo, 'scripts/showtime-chrome-extension/operator-public-hall-census.json'),
    'utf8',
  ),
)
const id = process.argv[2]
const start = process.argv[3] === undefined ? 0 : Number(process.argv[3])
assert(id && Object.hasOwn(census.venues, id), 'Unknown official Showtime hall census venue')
assert(Number.isInteger(start) && start >= 0 && start <= 35, 'Invalid movie offset')
const source = fs
  .readdirSync(research)
  .filter((name) => /^showtime_preview_showtime-.*\.json$/.test(name))
  .map((name) => JSON.parse(fs.readFileSync(path.join(research, name), 'utf8')))
const raw = fs
  .readdirSync(downloads)
  .filter((name) => /^showtime_sample_showtime-[a-z0-9-]+_[0-9]+\.json$/.test(name))
  .map((filename) => ({ filename, bytes: fs.readFileSync(path.join(downloads, filename)) }))
const audit = auditShowtimeCoverage(census, source, raw)
assert.equal(audit.errors.length, 0, 'Source audit errors prohibit public target scan')
assert.equal(audit.sourceDiscrepancies.length, 0, 'Source hall discrepancies prohibit scan')
const targets = audit.venues.find((v) => v.cinemaSlug === id)?.missingHallLabels ?? []
assert(targets.length > 0, 'No missing hall targets for this cinema')

// Same approved 15 venues as the read-only extension; no other site or account.
const cinemaNames = new Map([
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
const name = cinemaNames.get(id)
assert(name, 'Unknown cinema name')

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'theatgood-public-hall-event-'))
let browser
const report = {
  cinemaSlug: id,
  publicOnly: true,
  memberStateUsed: false,
  seatPreviewOpened: false,
  bookingActions: 0,
  movieStartIndex: start,
  movieCardLimit: 8,
  targetMissingHallLabels: targets,
  totalVisibleMovies: null,
  moviesChecked: 0,
  sameCardVenueHalls: [],
  seenMissingHalls: [],
  unseenCensusHalls: [],
  movieErrors: [],
}
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
  async function chooseVenue() {
    await page.goto('https://www.showtimes.com.tw/', {
      waitUntil: 'domcontentloaded',
      timeout: 20000,
    })
    await page.getByRole('link', { name: '快速訂票' }).click({ timeout: 10000 })
    await page.getByRole('button', { name, exact: true }).click({ timeout: 10000 })
    await page.getByText('立即訂票', { exact: true }).first().waitFor({ timeout: 12000 })
  }
  await chooseVenue()
  const filmCards = page.locator('div.group.cursor-pointer').filter({ hasText: '立即訂票' })
  report.totalVisibleMovies = await filmCards.count()
  for (let i = start; i < Math.min(start + 8, report.totalVisibleMovies); i++) {
    try {
      await filmCards.nth(i).click({ timeout: 8000 })
      await page.waitForURL(/\/ticketing\/selectEvents\//, { timeout: 9000 })
      const halls = await page.evaluate((cinemaName) => {
        const prefix = cinemaName + ' '
        const pattern = /^(?:\d+館)?(?:第?\d+|巨幕\d+|丹普|[A-Za-z0-9 ]+)廳$/
        const matches = []
        for (const card of document.querySelectorAll('.bg-card')) {
          const lines = String(card.innerText || '')
            .split('\n')
            .map((line) => line.replace(/\s+/g, ' ').trim())
            .filter(Boolean)
          const labels = [
            ...new Set(
              lines
                .filter((line) => line.startsWith(prefix))
                .map((line) => line.slice(prefix.length).trim())
                .filter((hall) => pattern.test(hall)),
            ),
          ]
          // An ambiguous card never certifies a hall identity.
          if (labels.length === 1) matches.push(labels[0])
        }
        return [...new Set(matches)]
      }, name)
      report.moviesChecked++
      for (const hall of halls)
        if (!report.sameCardVenueHalls.includes(hall)) report.sameCardVenueHalls.push(hall)
    } catch (error) {
      report.movieErrors.push({
        movieIndex: i,
        reason: String(error?.message ?? error)
          .split('\n')[0]
          .slice(0, 140),
      })
    } finally {
      if (page.url().includes('/ticketing/selectEvents/')) {
        await page.goBack({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => undefined)
      }
      if (!(await filmCards.count().catch(() => 0))) {
        await chooseVenue()
      }
    }
  }
  report.sameCardVenueHalls.sort()
  report.seenMissingHalls = targets.filter((hall) => report.sameCardVenueHalls.includes(hall))
  report.unseenCensusHalls = report.sameCardVenueHalls.filter(
    (hall) => !census.venues[id].includes(hall),
  )
  console.log(JSON.stringify(report))
} finally {
  if (browser) await browser.close()
  fs.rmSync(profile, { recursive: true, force: true, maxRetries: 2 })
}
