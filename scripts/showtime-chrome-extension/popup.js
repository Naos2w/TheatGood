/* global chrome, document */
const venues = [
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
]
document.getElementById('version').textContent = 'v' + chrome.runtime.getManifest().version
const select = document.getElementById('venue')
const run = document.getElementById('run')
const status = document.getElementById('status')
for (const [slug, name] of venues) {
  const option = document.createElement('option')
  option.value = slug
  option.textContent = name
  select.append(option)
}
async function render() {
  const s = await chrome.storage.local.get('theatgoodScanStatus')
  const x = s.theatgoodScanStatus
  if (!x) {
    status.textContent = '尚未開始。'
    return
  }
  run.disabled = x.state === 'running'
  status.textContent =
    x.state === 'running'
      ? '正在背景檢查 ' + x.name + '，不需要保持這個小視窗開啟。'
      : x.state === 'done'
        ? '已完成：' +
          x.name +
          '。\n取得座位預覽：' +
          x.layouts +
          ' 份\n資料已下載至本機。' +
          (x.warning ? '\n部分資料未取得：' + x.warning : '')
        : '未完成：' + (x.message || '未知原因')
}
async function startReadOnlyResearch(selected, options = {}) {
  if (!selected) {
    status.textContent = '未知分館'
    return false
  }
  run.disabled = true
  status.textContent =
    '已啟動唯讀蒐集。將使用已登入的秀泰分頁（不切換 Windows 焦點），請勿同時操作該分頁。'
  const reply = await chrome.runtime.sendMessage({
    action: 'scan',
    slug: selected[0],
    name: selected[1],
    ...options,
  })
  if (!reply?.accepted) {
    status.textContent = '不能啟動：' + (reply?.reason || '其他採集正在執行')
    run.disabled = false
    return false
  }
  return true
}
run.addEventListener('click', async () => {
  const selected = venues.find(([slug]) => slug === select.value)
  await startReadOnlyResearch(selected)
})
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.theatgoodScanStatus) void render()
})
void render()

// One-shot request from this computer's pre-installed TheatGood extension,
// for the user-authorised remote research workflow. This only opens the
// existing, safe background.js "scan" workflow; no seats, ticket types,
// account fields, cookies, or payment interfaces are clicked or inspected.
// Normal popup opens NEVER auto-run. A request must have an allowlisted
// cinema, a unique request ID and the explicit "read-only" acknowledgement.
async function maybeStartOneTimeLocalRequest() {
  const params = new globalThis.URL(globalThis.location.href).searchParams
  const slug = params.get('autorun')
  const once = params.get('once')
  const acknowledgement = params.get('ack')
  const rawTargets = params.get('targets')
  const rawStart = params.get('start')
  const targetOnly = rawTargets !== null
  const targetHalls = targetOnly ? rawTargets.split(',') : []
  const startMovie = rawStart === null ? 0 : Number(rawStart)
  if (!slug && !once && !acknowledgement) return
  const selected = venues.find(([id]) => id === slug)
  if (
    !selected ||
    acknowledgement !== 'read-only' ||
    !once ||
    !/^[a-zA-Z0-9-]{20,64}$/.test(once) ||
    (rawStart !== null && !targetOnly) ||
    (targetOnly &&
      (targetHalls.length < 1 ||
        targetHalls.length > 35 ||
        new Set(targetHalls).size !== targetHalls.length ||
        targetHalls.some((hall) => !hall || hall.length > 32) ||
        !Number.isInteger(startMovie) ||
        startMovie < 0 ||
        startMovie > 35))
  ) {
    status.textContent = '本機一次性研究指令無效；不執行任何蒐集。'
    return
  }
  const requestKey = 'theatgoodOnce-' + once
  const storage = await chrome.storage.local.get(['theatgoodScanStatus', requestKey])
  if (storage[requestKey]) {
    status.textContent = '這個一次性研究指令已使用；不重複執行。'
    return
  }
  if (storage.theatgoodScanStatus?.state === 'running') {
    status.textContent = '目前已有蒐集進行中，已拒絕新的一次性研究指令。'
    return
  }
  // Persist the request before dispatch: reloads/new windows cannot launch
  // the same request a second time. No external network or secrets involved.
  await chrome.storage.local.set({
    [requestKey]: { slug, submittedAt: new Date().toISOString() },
  })
  select.value = slug
  await startReadOnlyResearch(
    selected,
    targetOnly ? { targetOnly: true, targetHalls, startMovie } : {},
  )
}
void maybeStartOneTimeLocalRequest()
