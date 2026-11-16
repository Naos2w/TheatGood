# 真實電影放映場次：首個文化部開放資料 Adapter（P1.3；選用）

> **2026-11-16 需求變更：** TheatGood 的核心是影廳 2D／3D 座位視角與使用者自由輸入的個人觀影足跡。以下場次 API、官方連結與同步設計均為**既有可選功能／技術紀錄**，不再是核心 MVP 驗收、手動觀影紀錄或 Google 登入的先決條件。沒有場次 ID 或電影資料庫比對，也必須能保存「電影名稱＋日期＋影廳＋座位」。

查證日期：2026-11-16。

## 合法資料來源

- [文化部「電影」資料集（data.gov.tw #6010）](https://data.gov.tw/dataset/6010)：政府資料開放授權條款第 1 版（免費，官方註明每日更新），欄位包含活動 UID、名稱與 showInfo（時間、場館名稱／地址）。
- [官方 JSON 來源](https://cloud.culture.tw/frontsite/trans/SearchShowAction.do?method=doFindTypeJ&category=8)：2026-11-16 實測 HTTP 200，JSON 陣列提供電影活動和場次。不需要商業資料來源爬蟲或付費 API。
- [高雄市電影館官方資訊](https://kfa.kcg.gov.tw/tw/guide)；[內惟藝術中心官方資訊](https://www.nwac.org.tw/tw/cinema)；影廳匹配依此 Repo 既有可核實目錄。

**授權／署名：** App API 及頁面標示「資料來源：文化部藝文機構電影欣賞節目表（政府資料開放授權條款第 1 版）」並連結正式資料集。僅使用場次事實資料（電影名稱、日期、時間、場館、影廳、活動來源）；不複製海報、長篇介紹或圖片。

## 實作與保護

- `GET /api/screenings`：從官方 JSON 擷取，可在 Vercel Serverless 執行，**不需要資料庫密碼**。伺服器 8 秒請求逾時、失敗回 HTTP 503；CDN 可快取 15 分鐘。
- `normaliseCultureScreenings`：僅接受分類 8 且場次來源地點精確符合已建檔的高雄市電影館 3 樓／2F、小型放映室，及內惟 Reel ONE／TWO。單純寫「內惟藝術中心」的 VR 展覽沒有明確電影廳，不得猜測為 Reel ONE/TWO。
- 場次只有可信電影館而無具體影廳，設 `auditoriumSlug: null` 並顯示「影廳待確認」；此階段**未寫 Neon `auditorium_id`**。
- 來源時間採 `Asia/Taipei`（UTC+08:00），輸出 ISO UTC。無效日期略過；以「活動 UID＋具體影廳／unknown＋開始時間」去重，保留同片多場／多廳。
- 格式、語言、即時售票庫存如來源未提供，不猜測；UI 不提供購票與自動觀影紀錄。
- `/screenings` 使用伺服器 API，支援電影名稱／影城／日期篩選、只看未來場次和來源連結，保留官方資料授權標示。只有影廳目前存在正式 3D 模型時才顯示座位預覽入口。
- 不在 PR、Build 或測試期間呼叫正式 Neon；無遠端資料寫入、排程或自動取消。

## 受控保存到 Neon develop（手動，尚未啟用寫入）

- `npm run db:screenings:sync`：只讀預覽官方 JSON、正規化場次數量及日期範圍，完全不連 Neon。
- `npm run db:screenings:sync -- --write`：只有在明確提供 `THEATGOOD_ALLOW_SCREENING_SYNC=yes`、正確的 `NEON_DEV_BRANCH_ID` 和 **develop** 直連的 `DATABASE_URL` 時才能運作。核對已知 Endpoint hostname 及資料庫內部 `neon.branch_id`／`neon.endpoint_id` 後才開始匯入；正式／UAT 網址會被拒絕。
- 以一個資料庫交易和 advisory lock 匯入，同一 `provider + source_key` 不重複；已知場次可修正電影名稱與來源欄位，並更新 `fetched_at`。只有新觀察才插入新 `screenings`；已消失的活動不自動刪除或取消。
- 已有 7 項同步邏輯回歸測試，及官方資料唯讀實跑。**尚未取得 PC2 的 develop 資料庫憑證，也未執行任何真實寫入**；同步是否能成功持久化仍待安全環境實測與重跑驗證。
- 無新增正式 Serverless 寫入 Endpoint／排程，無修改 Production，所有 `watch_logs` 保持受保護。

## 四大商業影城：官方場次**外部入口**（2026-11-16 查證）

已在 `src/features/cinemas/official-showtimes.ts` 靜態整理並覆蓋 **40／40 間分館**。每個連結都只在使用者主動點擊時開啟官方網站，不在 TheatGood 擷取影片清單、時刻、場次 ID、票價、售票庫存或實際座位圖。

| 品牌        | 已對應 | 外部來源／範圍                                                                                                                                                                                                                                                                                                        |
| ----------- | -----: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 威秀／MUVIE |     22 | 威秀官網的 `/theater/detail.aspx?id=...` 分館場次頁 20 個與 `/theater/detail2.aspx?id=...` MUVIE 分館場次頁 2 個。[官方據點列表](https://www.vscinemas.com.tw/theater/)；[MUVIE 松仁](https://www.vscinemas.com.tw/theater/detail2.aspx?id=23)；[MUVIE 台中](https://www.vscinemas.com.tw/theater/detail2.aspx?id=12) |
| 秀泰        |     15 | 秀泰 `/cinemas/{id}/` 各分館自有時刻頁，逐一對照[官方據點列表](https://www.showtimes.com.tw/cinemas/)                                                                                                                                                                                                                 |
| 美麗華      |      1 | [美麗華官方場次](https://www.miramarcinemas.tw/Timetable/Index)                                                                                                                                                                                                                                                       |
| 美麗新      |      2 | 兩間都跳轉同一個[官方場次頁](https://www.miranewcinemas.com/Booking/Timetable)，**需由使用者在官網選擇分館**；不捏造未驗證的分館 deep link                                                                                                                                                                            |

**場次的營業日與曆日不一定相同。** [威秀官方訂票 QA](https://www.vscinemas.com.tw/qa/qalist.aspx?A=2) 明示官網場次營業日目前採 06:00～翌日 05:59，APP 以日曆日期 00:00～23:59 顯示；[美麗華場次頁](https://www.miramarcinemas.tw/Timetable/Index) 與 [美麗新場次頁](https://www.miranewcinemas.com/Booking/Timetable) 也說明營業日跨午夜規則。因此不應從官網畫面隨意自行解析或改成 UTC 時間，必須在取得授權 Adapter 後依品牌校驗日期／時間。

**授權現況：** 官網公開展示場次與影城可供使用者正常瀏覽，不等於授權第三方定期爬取、儲存、重新發布、使用售票 Session ID 或直接操作訂票。本 PR 只保存分館名稱對應的官方**連結**。四品牌合法場次 API、資料使用條款、取消／更新語義仍未確認，不把商業官網任何時刻誤認為本產品已同步。正式場次 Adapter 未建立，Neon、文化部資料與正式部署均保持原樣。

## 限制與下一步

文化部提供的是**部分文化場館電影欣賞活動**，不是威秀、秀泰、國賓等全院線的售票場次，也可能缺少廳號與放映格式。API 每次是官方目前公開資料的快照，**沒有持久化歷史、沒有資料庫去重／取消事件、沒有保證保留已過期場次**。不能因本期來源未列某場次就宣稱「已取消」。

**上述場次同步後續工作已在 2026-11-16 暫緩，不列入 TheatGood 座位模擬與手動觀影紀錄 MVP。** 若日後決定重新啟用場次同步，才需要在 Neon develop 安全實跑與重跑、確認時間與取消語義、授權條款及 TMDB 對照；不可讓這些選用工作阻擋個人觀影足跡。正式環境、個資與跨帳號紀錄的授權驗收仍屬 P2 核心需求。
