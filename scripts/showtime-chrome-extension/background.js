/* global chrome, document, location, history, setTimeout */
/**
 * Scoped Showtime research extension. Only captures factual seat labels and
 * relative on-screen positions from the authenticated operator's own preview.
 * This DOES NOT select a seat, start a cart, reserve, pay, read credentials,
 * read cookies or storage, or bypass any login / Cloudflare challenge.
 *
 * One already-authenticated tab, one venue, at most three movie cards and
 * four previews per movie. Deliberately fail closed when the page changes.
 */
const ALLOWED = new Map([
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
let running = false

// Reloading this unpacked extension cancels its service worker. Explicitly
// recover any prior stale UI state, without reading cookies or account data.
chrome.runtime.onInstalled.addListener(() => {
  void chrome.storage.local
    .get('theatgoodScanStatus')
    .then(({ theatgoodScanStatus: previous }) => {
      if (previous?.state !== 'running') return
      return chrome.storage.local.set({
        theatgoodScanStatus: {
          state: 'error',
          name: previous.name,
          slug: previous.slug,
          message:
            '前一輪蒐集逾時，已重載擴充功能並停止續跑。請先確認秀泰原分頁正常，再重新選擇分館。',
        },
      })
    })
    .catch(() => undefined)
})

async function scanTheatrePage(
  cinemaName,
  maxMovies,
  maxPreviews,
  allowedHallLabels,
  targetHallLabels = [],
  movieStartIndex = 0,
) {
  let stage = '初始化'
  let partial = null
  try {
    // Bound the cooperative DOM scan itself. Network and site UI errors may
    // still terminate the tab injection; never interpret a stalled status as
    // proof of a saved seat grid.
    const stopAt = Date.now() + 75000
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
    const timeout = async (find, limit = 12000) => {
      const start = Date.now()
      while (Date.now() - start < limit && Date.now() < stopAt) {
        const x = find()
        if (x) return x
        await sleep(220)
      }
      throw new Error('頁面內容逾時或需要重新驗證')
    }
    const exact = (nodes, text) =>
      [...nodes].filter((node) => (node.textContent || '').trim() === text)
    const buttons = () => [...document.querySelectorAll('button')]
    const signedIn = () =>
      buttons().some((button) => (button.textContent || '').trim() === '會員中心')
    const movieCards = () =>
      [...document.querySelectorAll('div.group.cursor-pointer')].filter((card) =>
        (card.textContent || '').includes('立即訂票'),
      )
    const hallPattern = /^(?:\d+館)?(?:第?\d+|巨幕\d+|丹普|[A-Za-z0-9 ]+)廳$/
    // A hall label alone is NOT evidence of venue identity: after a public
    // movie is opened, Showtime can show events for other cinema branches.
    // The *same individual screening card* must say e.g.
    // "台東秀泰影城 4廳". Never use the global page heading as proof.
    const allowedHalls = new Set(allowedHallLabels || [])
    // A targeted run can ONLY narrow the public hall census, never create
    // source labels or expand to another venue. No private API requests.
    if (
      !Array.isArray(targetHallLabels) ||
      targetHallLabels.length > 35 ||
      !Number.isInteger(movieStartIndex) ||
      movieStartIndex < 0 ||
      movieStartIndex > 35 ||
      !Number.isInteger(maxMovies) ||
      maxMovies < 1 ||
      maxMovies > 8
    ) {
      throw new Error('缺漏廳號研究參數不符合安全上限')
    }
    if (targetHallLabels.some((hall) => !allowedHalls.has(hall))) {
      throw new Error('要求的廳號不在本館公開廳號樣本，已拒絕操作')
    }
    const targetedHalls = new Set(targetHallLabels)
    const venueHallFromScreeningCard = (button) => {
      const card = button.closest?.('.bg-card')
      if (!card) return null
      const lines = String(card.innerText || '')
        .split('\n')
        .map((line) => line.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
      const prefix = cinemaName + ' '
      const exactMatches = [
        ...new Set(
          lines
            .filter((line) => line.startsWith(prefix))
            .map((line) => line.slice(prefix.length).trim())
            .filter((hall) => hallPattern.test(hall)),
        ),
      ]
      if (exactMatches.length !== 1) return null
      return exactMatches[0]
    }
    const seatLabel = (button) => {
      const labels = [
        button.getAttribute('aria-label'),
        button.getAttribute('title'),
        (button.textContent || '').trim(),
      ]
      for (const label of labels) {
        const match = String(label || '').match(/^座位\s*([A-Z]+|\d+)排(\d+)號$/)
        if (match)
          return {
            label: match[1] + '排' + match[2] + '號',
            rowLabel: match[1],
            seatNumber: Number(match[2]),
          }
      }
      return null
    }
    const getSeatButtons = () =>
      buttons()
        .map((button) => ({ button, id: seatLabel(button) }))
        .filter((s) => s.id)
    const median = (array) => {
      if (!array.length) throw new Error('座位格線間距不足')
      const sorted = [...array].sort((a, b) => a - b)
      return sorted[Math.floor(sorted.length / 2)]
    }
    const seatPositions = () => {
      const observed = getSeatButtons().map(({ button, id }) => {
        const box = button.getBoundingClientRect()
        return { ...id, x: box.left, y: box.top, width: box.width, height: box.height }
      })
      if (
        observed.length < 20 ||
        observed.length > 1000 ||
        observed.some((s) => s.width <= 5 || s.height <= 5)
      ) {
        throw new Error('可辨識座位數或位置不合理')
      }
      const byY = new Map()
      for (const seat of observed) {
        const k = Math.round(seat.y)
        const list = byY.get(k) || []
        list.push(seat.x)
        byY.set(k, list)
      }
      const dx = []
      for (const group of byY.values()) {
        const sorted = [...new Set(group)].sort((a, b) => a - b)
        for (let i = 1; i < sorted.length; i++) {
          const diff = sorted[i] - sorted[i - 1]
          if (diff > 7 && diff < 50) dx.push(diff)
        }
      }
      const stepX = dx.length >= 10 ? median(dx) : median(observed.map((s) => s.width)) + 3
      const y = [...new Set(observed.map((s) => Math.round(s.y)))].sort((a, b) => a - b)
      const dy = y
        .slice(1)
        .map((n, i) => n - y[i])
        .filter((n) => n > 7 && n < 55)
      const stepY = dy.length ? Math.min(...dy) : median(observed.map((s) => s.height)) + 2
      if (stepX < 13 || stepY < 13) throw new Error('座位格線間距無法判定')
      const minX = Math.min(...observed.map((s) => s.x))
      const minY = Math.min(...observed.map((s) => s.y))
      const list = observed
        .map((seat) => {
          const col = (seat.x - minX) / stepX
          const row = (seat.y - minY) / stepY
          if (Math.abs(col - Math.round(col)) > 0.18 || Math.abs(row - Math.round(row)) > 0.18) {
            throw new Error('座位相對位置未通過校驗')
          }
          return {
            label: seat.label,
            rowLabel: seat.rowLabel,
            seatNumber: seat.seatNumber,
            gridRow: Math.round(row) + 1,
            gridColumn: Math.round(col) + 1,
          }
        })
        .sort((a, b) => a.gridRow - b.gridRow || a.gridColumn - b.gridColumn)
      if (
        new Set(list.map((s) => s.label)).size !== list.length ||
        new Set(list.map((s) => s.gridRow + '/' + s.gridColumn)).size !== list.length
      ) {
        throw new Error('座號或座標重複')
      }
      return { list, rows: new Set(list.map((s) => s.rowLabel)).size }
    }
    const closePreview = () => {
      const dialog = [...document.querySelectorAll('[role="dialog"]')].find((el) =>
        (el.textContent || '').includes('座位預覽'),
      )
      if (!dialog) throw new Error('座位預覽視窗不見了')
      const candidate = [...dialog.querySelectorAll('button')].find((button) =>
        ['關閉', 'Close'].includes(
          button.getAttribute('aria-label') ||
            button.getAttribute('title') ||
            (button.textContent || '').trim(),
        ),
      )
      if (!candidate) throw new Error('找不到安全的預覽關閉按鈕')
      candidate.click()
    }
    partial = {
      sourceType: 'showtime_authenticated_chrome_extension_read_only',
      sampledAt: new Date().toISOString(),
      cinemaName,
      sourceUrl: 'https://www.showtimes.com.tw/',
      researchOnly: true,
      bookingActionPerformed: false,
      actualSeatClicked: 0,
      checkoutNotOpened: true,
      credentialsRead: false,
      seatAvailabilityRetained: false,
      venueVerificationMethod: 'exact_venue_plus_hall_on_same_screening_card',
      movieCardsChecked: 0,
      seatPreviewModalsOpened: 0,
      layouts: [],
      errors: [],
    }
    stage = '檢查登入狀態'
    await timeout(() => document.querySelector('body'), 12000)
    if (!signedIn()) throw new Error('未顯示會員中心；不讀取登入資料，也不繞過 Cloudflare')
    stage = '尋找分館選擇入口'
    const quick = exact(document.querySelectorAll('a'), '快速訂票')[0]
    if (!quick) throw new Error('找不到公開的快速訂票分館入口')
    quick.click()
    const venue = await timeout(() => exact(buttons(), cinemaName)[0], 10000)
    stage = '讀取' + cinemaName + '公開電影清單'
    venue.click()
    await timeout(() => movieCards().length > 0, 12000)
    const moviesSeen = movieCards().length
    const endMovie = Math.min(movieStartIndex + maxMovies, moviesSeen)
    for (let i = movieStartIndex; i < endMovie; i++) {
      if (Date.now() >= stopAt) {
        partial.errors.push('本輪已達安全時間上限，未再開啟其他場次')
        break
      }
      stage = '讀取第' + (i + 1) + '部電影場次'
      try {
        if (!signedIn()) throw new Error('會員工作階段失效，停止')
        const cards = movieCards()
        if (i >= cards.length) break
        cards[i].click()
        await timeout(() => location.pathname.startsWith('/ticketing/selectEvents/'), 10000)
        partial.movieCardsChecked++
        if (!signedIn()) throw new Error('會員工作階段失效，停止')
        const previews = buttons().filter((b) => (b.textContent || '').trim() === '座位')
        const seen = new Set()
        for (let j = 0; j < previews.length && seen.size < maxPreviews; j++) {
          if (Date.now() >= stopAt) {
            partial.errors.push('本輪已達安全時間上限，其他場次未讀取')
            break
          }
          const next = buttons().filter((b) => (b.textContent || '').trim() === '座位')[j]
          if (!next) break
          const hall = venueHallFromScreeningCard(next)
          if (!hall) {
            partial.errors.push(
              '已略過其他分館或缺少明確「' + cinemaName + ' 廳號」的場次；未讀取座位',
            )
            continue
          }
          if (!allowedHalls.has(hall)) {
            partial.errors.push('廳號「' + hall + '」不在本館既有公開廳號清單，已略過，需人工查證')
            continue
          }
          if (targetedHalls.size && !targetedHalls.has(hall)) continue
          if (seen.has(hall)) continue
          seen.add(hall)
          if (partial.layouts.some((l) => l.hallLabel === hall)) continue
          stage = '讀取' + hall + '座位預覽'
          next.click()
          partial.seatPreviewModalsOpened++
          try {
            await timeout(() => getSeatButtons().length >= 20, 13000)
            const positions = seatPositions()
            partial.layouts.push({
              hallLabel: hall,
              ordinarySeatCount: positions.list.length,
              rowsCount: positions.rows,
              seatPositions: positions.list,
              screenWidthM: null,
              screenHeightM: null,
              rowPitchM: null,
              seatPitchM: null,
              wheelchairLayoutVerified: false,
              sourceEvidence: 'signed_in_operator_preview_with_same_screening_card_venue_verified',
              sourceSessionCinemaName: cinemaName,
              venueMatchedOnIndividualSessionCard: true,
              geometryUnits: 'relative_css_grid_not_metres',
            })
          } finally {
            closePreview()
            await sleep(180)
          }
        }
      } catch (err) {
        partial.errors.push('第' + (i + 1) + '部電影：' + String(err).slice(0, 150))
        if (!signedIn()) break
      } finally {
        if (location.pathname.startsWith('/ticketing/selectEvents/')) {
          history.back()
          await timeout(() => movieCards().length > 0, 11000).catch(() => undefined)
        }
      }
    }
    stage = '完成檢查'
    if (partial.layouts.length === 0) {
      return {
        ok: false,
        code: targetedHalls.size ? 'NO_MISSING_HALLS_IN_SAMPLE' : 'NO_SEAT_LAYOUTS',
        stage,
        message:
          (targetedHalls.size
            ? '此輪電影場次未提供已核實來源的指定缺漏廳號座位預覽'
            : partial.errors[0]) ||
          (partial.seatPreviewModalsOpened === 0
            ? '這次沒有找到可讀的「座位預覽」場次；可能尚未排片或網站版面已變更'
            : '已開啟座位預覽，但沒有座號通過位置校驗'),
        movieCardsChecked: partial.movieCardsChecked,
        seatPreviewsOpened: partial.seatPreviewModalsOpened,
      }
    }
    return { ok: true, data: partial }
  } catch (error) {
    // Chrome scripting.executeScript may otherwise return undefined on
    // a rejected promise. Never swallow the actual reason or include
    // sensitive account/seat availability data in the diagnostic.
    return {
      ok: false,
      code: 'SCAN_FAILED',
      stage,
      message: String(error?.message || error).slice(0, 220),
      movieCardsChecked: partial?.movieCardsChecked ?? 0,
      seatPreviewsOpened: partial?.seatPreviewModalsOpened ?? 0,
      partialData: partial?.layouts?.length ? partial : null,
    }
  }
}

async function readMemberStatus(tabId) {
  // Single purpose: whether the visible website already displays the
  // authenticated "會員中心" button. Never inspect login fields, storage,
  // cookies, account identifiers, or the Cloudflare challenge implementation.
  const output = await chrome.scripting.executeScript({
    target: { tabId },
    func: async () => {
      const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
      for (let attempt = 0; attempt < 16; attempt++) {
        const names = [...document.querySelectorAll('button')].map((button) =>
          (button.textContent || '').trim(),
        )
        if (names.includes('會員中心')) return 'signed-in'
        if (names.includes('登入')) return 'login-required'
        await delay(250)
      }
      return 'unknown'
    },
    world: 'ISOLATED',
  })
  return output?.[0]?.result || 'unknown'
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.action !== 'scan') return false
  if (running) {
    sendResponse({ accepted: false, reason: '已有背景採集執行中' })
    return false
  }
  if (!ALLOWED.has(msg.slug) || ALLOWED.get(msg.slug) !== msg.name) {
    sendResponse({ accepted: false, reason: '非核准的秀泰分館' })
    return false
  }
  const targeted = msg.targetOnly === true
  const targets = targeted ? msg.targetHalls : []
  const movieStart = targeted ? msg.startMovie : 0
  if (
    targeted &&
    (!Array.isArray(targets) ||
      targets.length < 1 ||
      targets.length > 35 ||
      new Set(targets).size !== targets.length ||
      targets.some((name) => typeof name !== 'string' || name.length > 32) ||
      !Number.isInteger(movieStart) ||
      movieStart < 0 ||
      movieStart > 35)
  ) {
    sendResponse({ accepted: false, reason: '未提供有效的本館缺漏廳號清單或電影偏移' })
    return false
  }
  running = true
  sendResponse({ accepted: true })
  void (async () => {
    const slug = msg.slug
    const name = msg.name
    let tabId
    try {
      await chrome.storage.local.set({ theatgoodScanStatus: { state: 'running', slug, name } })
      // Showtime's authenticated state may be scoped to the actual tab.
      // Creating a new tab does not reliably inherit that state, even if
      // the openerTabId points to the signed-in tab. Use the *existing*
      // user-authorised Showtime tab without activating or focusing it.
      const candidates = await chrome.tabs.query({ url: 'https://www.showtimes.com.tw/*' })
      for (const candidate of candidates) {
        if (!Number.isInteger(candidate.id)) continue
        const memberState = await readMemberStatus(candidate.id).catch(() => 'unknown')
        if (memberState === 'signed-in') {
          tabId = candidate.id
          break
        }
      }
      if (!Number.isInteger(tabId)) {
        throw new Error(
          '找不到已顯示「會員中心」的秀泰分頁。請在專用 Chrome 保留該登入分頁；不需要重新登入或複製會員資料。',
        )
      }
      // The public hall-name census is a *secondary* guard. The primary
      // proof must still come from the individual operator screening card.
      const knownSource = await globalThis.fetch(
        chrome.runtime.getURL('operator-public-hall-census.json'),
      )
      if (!knownSource.ok) throw new Error('既有公開廳號清單無法載入，已停止匯出')
      const census = await knownSource.json()
      const allowedHalls = census.venues?.[slug]
      if (!Array.isArray(allowedHalls) || allowedHalls.length === 0) {
        throw new Error('此分館沒有經核對的公開廳號清單，已停止匯出')
      }
      if (targets.some((hall) => !allowedHalls.includes(hall))) {
        throw new Error('指定缺漏廳號不在本館既有公開清單，拒絕掃描')
      }
      // DOM clicks execute within the existing tab. No browser tab/window
      // activation or Win32 desktop interactions are permitted.
      // This tab's content/navigation will change during this single run.
      const output = await chrome.scripting.executeScript({
        target: { tabId },
        func: scanTheatrePage,
        // Targeted mode reviews a different bounded slice of film cards,
        // opening only previews for previously unverified hall labels.
        args: [name, targeted ? 8 : 3, 4, allowedHalls, targets, movieStart],
        world: 'ISOLATED',
      })
      const injection = output?.[0]
      if (!injection) {
        throw new Error(
          '背景腳本沒有回傳結果；可能是網站導覽使腳本中斷，請檢查背景頁是否仍正常開啟',
        )
      }
      if (injection.error) {
        const reason = String(injection.error.message || injection.error).slice(0, 160)
        throw new Error('瀏覽器腳本執行失敗：' + reason)
      }
      const scan = injection.result
      if (!scan || typeof scan !== 'object') {
        throw new Error('背景腳本未提供可解析的資料；請重新載入擴充功能，不要重新登入秀泰')
      }
      const warning =
        scan.ok === false
          ? String(scan.stage || '未知階段') +
            '：' +
            String(scan.message || scan.code || '未知錯誤')
          : null
      if (scan.ok === false && !scan.partialData?.layouts?.length) {
        throw new Error(warning.slice(0, 240))
      }
      const data = scan.ok === true ? scan.data : scan.partialData
      if (
        !data ||
        !Array.isArray(data.layouts) ||
        data.layouts.length === 0 ||
        data.bookingActionPerformed !== false ||
        data.actualSeatClicked !== 0 ||
        data.credentialsRead !== false ||
        data.seatAvailabilityRetained !== false ||
        data.venueVerificationMethod !== 'exact_venue_plus_hall_on_same_screening_card' ||
        !data.layouts.every(
          (layout) =>
            layout.venueMatchedOnIndividualSessionCard === true &&
            layout.sourceSessionCinemaName === name &&
            allowedHalls.includes(layout.hallLabel),
        )
      ) {
        throw new Error('收到座位資料但無法逐場次核實影城或唯讀安全欄位，已拒絕儲存，沒有進行訂票')
      }
      const json = JSON.stringify({ ...data, cinemaSlug: slug }, null, 2)
      const fileName = 'TheatGood/showtime_sample_' + slug + '_' + Date.now() + '.json'
      const downloadUrl = 'data:application/json;charset=utf-8,' + encodeURIComponent(json)
      await chrome.downloads.download({
        url: downloadUrl,
        filename: fileName,
        saveAs: false,
        conflictAction: 'uniquify',
      })
      await chrome.storage.local.set({
        theatgoodScanStatus: {
          state: 'done',
          slug,
          name,
          layouts: data.layouts.length,
          movies: data.movieCardsChecked,
          errors: data.errors.length,
          warning: warning ? warning.slice(0, 240) : data.errors[0]?.slice(0, 200) || null,
          partial: Boolean(warning),
          targetedHallsOnly: targeted,
          movieStart,
          output: 'Downloads/' + fileName,
        },
      })
    } catch (error) {
      await chrome.storage.local.set({
        theatgoodScanStatus: {
          state: 'error',
          slug,
          name,
          message: String(error?.message || error).slice(0, 180),
        },
      })
    } finally {
      // The scanned tab is the ORIGINAL signed-in Showtime tab.
      // Never close it, change its active state, or touch another window.
      running = false
    }
  })()
  return false
})
