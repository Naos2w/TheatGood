# P2 私人觀影足跡：離線資料契約與安全匯入前置（2026-11-20）

> 僅是 **Dev 程式碼候選與 SQL Migration 草稿**。沒有執行任何 Neon Migration、資料讀寫、帳號設定、Google OAuth、API 部署或跨裝置同步。**不代表 P2 已完成。**

## 已直接查到的 Neon 狀態

- Project：TheatGood（Neon）；開發分支：`develop`，資料庫：`theatgood`。
- 2026/11/20 透過唯讀查詢確認 `public.watch_logs` 已存在，欄位含 `user_id`、`watched_at`、`seat_label`、`movie_title` 等。
- 同分支 `get_neon_auth_config` 明確回報：**Neon Auth is not enabled for this branch**。因此目前**不准**把任何訪客身份或前端自行提交的 `userId` 當作已驗證帳號。
- 舊資料表不完整：缺少使用者輸入的精確觀影日期（原本是日期，不是時間）、影城 slug、瀏覽器模型 slug／版本、原本更新時間，若直接匯入將無法無損還原足跡視角。

## 本次實作（僅原始碼）

1. 把 `manualWatchEntrySchema` 移至**不依賴 Vue／Vite** 的純 Zod 模組，讓瀏覽器與未來後端採同一份資料驗證規則，保留舊匯入相容。
2. `db/schema.ts` 與生成的 `db/migrations/0002_easy_spot.sql` 增加 5 個**可空且向下相容**欄位：`watched_on`、`cinema_slug`、`local_model_id`、`local_model_version`、`updated_at`。尚未執行 Migration，不能視為資料庫已更新。
3. `toCloudWatchLogRow` 保留現有本機紀錄 ID、電影自由文字、日期、影城／廳別、座號、模型版本及建立／修改時間；絕不把瀏覽器字串 `modelId` 假冒資料庫模型 UUID。因舊表要求 `watched_at`，以觀影當日**台北中午**作技術相容錨點；它不代表真實放映時間，真實使用者日期儲於 `watched_on`。
4. `fromCloudWatchLogRow` 只處理能完整還原的手動記錄；對沒有 `watched_on`／`updated_at` 等欄位的舊資料**保守拒絕**，不自行創造觀影日期。
5. `planInitialCloudHistoryImport` 是純計畫函式：沒有登入身份或未得到使用者的明確匯入同意，**不得產生匯入清單**；非此帳號的遠端記錄、壞資料或重複 UUID 直接報錯。已存在的相同紀錄跳過、遠端獨有紀錄保留、同 UUID 內容不同者列為衝突，**不依時間戳自行覆蓋、不刪除任何紀錄**。

## 尚未完成，絕不可宣稱已安全上線

- Neon 開發分支啟用 Auth（目前未啟用）及確認 Google OAuth 是否可用、授權來源與網域。
- **後端**驗證 Neon 簽章／有效期／使用者身份後，再將該身分作為 `watch_logs.user_id`，未驗證前不得呼叫任何資料讀寫。任何前端 `userId` 都不可信。
- PostgreSQL RLS 或受驗證伺服器查詢的 owner-scoped 權限，至少測試使用者 A 不能查／改／刪 B 的紀錄；本次純函式拒絕外來帳號並**不等於實際資料庫權限驗收**。
- 安全的線上 Migration、私有 CRUD、刪除 tombstone／跨裝置衝突合併，以及正式的資料備份／還原測試。
- 對已存在瀏覽器的資料只在登入後由**使用者選擇**是否匯入；首次匯入前先保留本機原始資料，不以雲端空列表覆寫本機。

這一批程式碼沒有 UI 變動，也沒有任何線上私人資料流入本機檔案、Git、測試或回報。
