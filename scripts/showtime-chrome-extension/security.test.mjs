import assert from 'node:assert/strict'
import console from 'node:console'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8')
const manifest = JSON.parse(read('manifest.json'))
const workerSource = read('background.js')
const popupSource = read('popup.js')

test('extension is restricted to Showtime without cookie, debugger, or unrelated-site access', () => {
  assert.equal(manifest.manifest_version, 3)
  assert.equal(manifest.version, '0.1.6')
  assert.deepEqual(manifest.host_permissions, [
    'https://www.showtimes.com.tw/*',
    'https://showtimes.com.tw/*',
  ])
  assert.deepEqual([...manifest.permissions].sort(), ['downloads', 'scripting', 'storage'])
  assert.equal(manifest.background.service_worker, 'background.js')
  assert.equal(manifest.action.default_popup, 'popup.html')
  for (const forbidden of [
    'chrome.cookies',
    'chrome.debugger',
    'chrome.webRequest',
    'nativeMessaging',
    '<all_urls>',
  ]) {
    assert(!workerSource.includes(forbidden))
  }
  assert(!workerSource.includes('chrome.tabs.create('), 'Do not create a new login-less tab')
  assert(!workerSource.includes('chrome.tabs.remove('), 'Never close the original signed-in tab')
  assert(!workerSource.includes('chrome.tabs.update('), 'Do not activate or navigate another tab')
  assert(!workerSource.includes('chrome.windows.update('), 'Do not alter desktop window focus')
})

test('all 15 Showtime venue identifiers match the sampled public hall-name census', () => {
  const source = JSON.parse(
    fs.readFileSync(path.join(root, 'operator-public-hall-census.json'), 'utf8'),
  )
  const expected = new Set(Object.keys(source.venues))
  assert.equal(expected.size, 15)
  const slugs = (text) =>
    new Set([...text.matchAll(/\['(showtime-[a-z0-9-]+)',\s*'[^']+'\]/g)].map((match) => match[1]))
  assert.deepEqual([...slugs(workerSource)].sort(), [...expected].sort())
  assert.deepEqual([...slugs(popupSource)].sort(), [...expected].sort())
})

function createScanner(document, location, history) {
  let called = 0
  const chrome = {
    runtime: {
      onInstalled: { addListener: () => undefined },
      onMessage: {
        addListener: () => {
          called++
        },
      },
    },
  }
  const sandbox = {
    chrome,
    document,
    location,
    history,
    setTimeout: globalThis.setTimeout,
    console,
  }
  const runner = vm.runInNewContext(workerSource + '\nscanTheatrePage', sandbox)
  assert.equal(called, 1)
  return runner
}

test('without authenticated member control, scan refuses to click or save any seats', async () => {
  let clicks = 0
  const document = {
    querySelector: () => ({}),
    querySelectorAll: () => [
      {
        textContent: '登入',
        click: () => {
          clicks++
        },
      },
    ],
  }
  const runner = createScanner(document, { pathname: '/' }, { back: () => {} })
  const outcome = await runner('台東秀泰影城', 1, 1)
  assert.equal(outcome.ok, false)
  assert.equal(outcome.code, 'SCAN_FAILED')
  assert.equal(outcome.stage, '檢查登入狀態')
  assert.match(outcome.message, /會員中心/)
  assert.equal(outcome.partialData, null)
  assert.equal(clicks, 0)
})

test('a synthetic authorised seat preview only exports labels/relative positions, never selects any seat', async () => {
  let state = 'home'
  const location = { pathname: '/' }
  let seatClicks = 0
  let safePreviewClicks = 0
  const memberButton = { textContent: '會員中心', getAttribute: () => null }
  const leaf = { childElementCount: 0, textContent: '1廳' }
  const ancestor = {
    innerText: '台東秀泰影城 1廳',
    querySelectorAll: () => [leaf],
    parentElement: null,
  }
  const quick = {
    textContent: '快速訂票',
    click: () => {
      state = 'choose'
    },
  }
  const venue = {
    textContent: '台東秀泰影城',
    click: () => {
      state = 'movies'
    },
  }
  const card = {
    textContent: '電影立即訂票',
    click: () => {
      state = 'details'
      location.pathname = '/ticketing/selectEvents/7'
    },
  }
  const preview = {
    textContent: '座位',
    getAttribute: () => null,
    parentElement: ancestor,
    closest: () => ancestor,
    click: () => {
      safePreviewClicks++
      state = 'preview'
    },
  }
  const closeButton = {
    textContent: '關閉',
    getAttribute: (key) => (key === 'aria-label' ? '關閉' : null),
    click: () => {
      state = 'details'
    },
  }
  const seats = []
  for (let row = 1; row <= 3; row++) {
    for (let number = 1; number <= 10; number++) {
      seats.push({
        textContent: '',
        getAttribute: (key) => (key === 'aria-label' ? '座位 ' + row + '排' + number + '號' : null),
        getBoundingClientRect: () => ({
          left: 100 + (number - 1) * 25,
          top: 90 + (row - 1) * 25,
          width: 22,
          height: 23,
        }),
        click: () => {
          seatClicks++
          throw Error('Forbidden: clicked an actual seat')
        },
      })
    }
  }
  const dialog = {
    textContent: '座位預覽',
    querySelectorAll: (sel) => (sel === 'button' ? [closeButton] : []),
  }
  const doc = {
    querySelector: (selector) => (selector === 'body' ? {} : null),
    querySelectorAll: (selector) => {
      if (selector === 'button') {
        if (state === 'choose') return [memberButton, venue]
        if (state === 'details') return [memberButton, preview]
        if (state === 'preview') return [memberButton, preview, ...seats]
        return [memberButton]
      }
      if (selector === 'a') return state === 'home' ? [quick] : []
      if (selector === 'div.group.cursor-pointer') return state === 'movies' ? [card] : []
      if (selector === '[role="dialog"]') return state === 'preview' ? [dialog] : []
      return []
    },
  }
  const history = {
    back: () => {
      state = 'movies'
      location.pathname = '/ticketing'
    },
  }
  const scanner = createScanner(doc, location, history)
  const outcome = await scanner('台東秀泰影城', 1, 1, ['1廳'])
  assert.equal(outcome.ok, true, JSON.stringify(outcome))
  const out = outcome.data
  assert.equal(out.movieCardsChecked, 1)
  assert.equal(out.seatPreviewModalsOpened, 1)
  assert.equal(out.layouts.length, 1, JSON.stringify(out.errors))
  assert.equal(out.layouts[0].hallLabel, '1廳')
  assert.equal(out.layouts[0].ordinarySeatCount, 30)
  assert.equal(out.layouts[0].rowsCount, 3)
  assert.equal(out.layouts[0].seatPositions.length, 30)
  assert.equal(out.bookingActionPerformed, false)
  assert.equal(out.venueVerificationMethod, 'exact_venue_plus_hall_on_same_screening_card')
  assert.equal(out.layouts[0].venueMatchedOnIndividualSessionCard, true)
  assert.equal(out.layouts[0].sourceSessionCinemaName, '台東秀泰影城')
  assert.equal(out.actualSeatClicked, 0)
  assert.equal(out.checkoutNotOpened, true)
  assert.equal(out.credentialsRead, false)
  assert.equal(out.seatAvailabilityRetained, false)
  assert.equal(out.layouts[0].screenWidthM, null)
  assert.equal(out.layouts[0].screenHeightM, null)
  assert.equal(safePreviewClicks, 1)
  assert.equal(seatClicks, 0)

  // Regression: the old exporter claimed everything was Taitung even when
  // the screening card belonged to a completely different cinema.
  ancestor.innerText = '台北欣欣秀泰影城 1廳'
  state = 'home'
  location.pathname = '/'
  const foreign = await scanner('台東秀泰影城', 1, 1, ['1廳'])
  assert.equal(foreign.ok, false)
  assert.equal(foreign.code, 'NO_SEAT_LAYOUTS')
  assert.match(foreign.message, /已略過其他分館/)
  assert.equal(safePreviewClicks, 1, 'Must never preview a foreign venue')
  assert.equal(seatClicks, 0)

  // Even the correct venue text may not claim a previously unobserved hall
  // without independent source confirmation.
  ancestor.innerText = '台東秀泰影城 12廳'
  state = 'home'
  location.pathname = '/'
  const unknown = await scanner('台東秀泰影城', 1, 1, ['1廳'])
  assert.equal(unknown.ok, false)
  assert.match(unknown.message, /不在本館既有公開廳號清單/)
  assert.equal(safePreviewClicks, 1)
  assert.equal(seatClicks, 0)

  // Target-only mode: even an authentic hall must NOT be opened unless it
  // is one of the user's specifically missing hall labels. Film index and
  // target identity are passed as plain, allowlist-checked metadata.
  ancestor.innerText = '台東秀泰影城 1廳'
  state = 'home'
  location.pathname = '/'
  const notMissing = await scanner('台東秀泰影城', 1, 1, ['1廳', '2廳'], ['2廳'], 0)
  assert.equal(notMissing.ok, false)
  assert.equal(notMissing.code, 'NO_MISSING_HALLS_IN_SAMPLE')
  assert.equal(safePreviewClicks, 1, 'Already sourced halls cannot open in targeted mode')
  assert.equal(seatClicks, 0)

  state = 'home'
  location.pathname = '/'
  const targeted = await scanner('台東秀泰影城', 1, 1, ['1廳', '2廳'], ['1廳'], 0)
  assert.equal(targeted.ok, true, JSON.stringify(targeted))
  assert.equal(targeted.data.layouts[0].hallLabel, '1廳')
  assert.equal(safePreviewClicks, 2)
  assert.equal(seatClicks, 0)

  state = 'home'
  location.pathname = '/'
  const invalidTarget = await scanner('台東秀泰影城', 1, 1, ['1廳'], ['12廳'], 0)
  assert.equal(invalidTarget.ok, false)
  assert.match(invalidTarget.message, /不在本館公開廳號樣本/)
  assert.equal(safePreviewClicks, 2)
})
