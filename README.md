# TheatGood

**台灣影廳 3D 座位視角預覽與個人觀影紀錄 App**

以 Vue 3 / TresJS 開發，從台灣影廳的公開資料建立 3D 模型、座位圖與第一人稱視角，並整合部分可核實的台灣公開電影場次。個人觀影紀錄仍待開發；**不做評分、心得、社群或即時訂票**。

## 目前可使用（P0 + P1 部分功能 + v2 UI）

- **國家電影及視聽文化中心「小影格」**：官方設備手冊提供 **8.88 × 4.80 m** 銀幕、**52 席**座位圖（另有 2 輪椅席，尚未建模），可進入 3D 模型選位。
- **光點台北電影館「光點電影院」**：官方座位圖 **83 席（含可置換的輪椅席）**、銀幕 **4.70 × 1.85 m**，保留原始 `1-1`～`9-9` 座號及中央走道；3D 排距仍為估算。
- **連鎖影城優先入口**：已由官方據點頁核對威秀（含 MUVIE）22、秀泰 15、美麗華 1、美麗新 2，共 **40 個分館**，首頁優先提供品牌／地區／名稱搜尋與官方連結。每個分館都有獨立資料頁：威秀依 2026/05/21 官方席數表收錄 **229 筆逐廳席數**；美麗華新增 **10 筆官方逐廳席數**；秀泰 11 分館有可辨識範圍的公布廳數、7 分館有公布全館席數；美麗新新增大直／台茂皇家影廳的局部規格。這些不等於完整座位圖，也未接入即時場次或線上訂位。來源與限制見 [連鎖影城來源](docs/chain-directory.md)。
- **官方影廳目錄**：另有原始 5 座文化電影場館／9 間影廳，其中 2 間座位資料足夠提供 3D。其餘只顯示可查證的規格，不杜撰座位圖。
- **附近影城探索**：支援關鍵字、地區、品牌與 3D 可用性篩選；按一下定位按鈕授權後，對**36/40 個有可追溯 OSM 點位的連鎖分館**及既有 5 座文化電影場館進行直線距離排序（非交通里程）。其餘 4 間分館仍可搜尋、列在距離排序後方，且不顯示捏造的里程。定位只在瀏覽器本頁計算。
- **真實放映場次（P1.3 初版）**：`/screenings` 從文化部「電影」開放資料的 `/api/screenings` 查詢部分可核對的高雄市電影館／內惟藝術中心場次，支援電影名稱、電影館與日期篩選，保留原始公告來源。**非全台院線場次，也沒有售票庫存或已持久化的歷史紀錄**；來源與限制見 [場次資料文件](docs/showtime-sources.md)。
- **光點華山電影館規格**：官方銀幕尺寸已查證 A One 8.8 × 3.8 m、A Two 8.6 × 3.4 m，但仍缺完整座號資料，暫不開放這兩廳的 3D。
- **TheatGood 示範影廳**：114 席完全虛構模型，供測試 3D 視角引擎，不顯示在真實影廳目錄。
- 座位 2D / 3D 共用同一份模型座標與座號；先在 2D 選位，再進入全螢幕第一人稱 3D，並可左右切換相鄰座位。
- 顯示與銀幕的估算距離、水平／垂直視角與偏移角。
- 支援手機／平板／桌面 RWD、Light／Dark／System 主題和繁體中文／英式英文；WebGL 2 不支援時仍可保留 2D 座位選擇。

**資料準確度：小影格與光點台北的官方銀幕規格及座號均有來源；座距、坡度、銀幕底緣高度、曲率、人眼高度及牆面等仍屬估算。** 模型不等於現場視野，亦不提供售票座位庫存。資料來源見 [影廳目錄](docs/auditorium-directory.md)、[小影格](docs/auditoriums/tfai-small.md)、[光點台北](docs/auditoriums/spot-taipei.md)。

## 本機啟動

需 Node.js 22.12+（建議 Node.js 24）與 npm。

```bash
npm install --include=dev
npm run dev
```

用瀏覽器開啟 Vite 顯示的地址（通常為 `http://localhost:5173`）。

```bash
npm run schema:generate # 從 Zod 型別產生 public/schemas/auditorium-v1.schema.json
npm run typecheck
npm run lint
npm run test
npm run build
npm run format:check
npm run db:screenings:sync # 只讀預覽官方電影場次；不連線／不修改資料庫
```

若全域 npm 設定了 `omit=dev`，使用 `npm install --include=dev` 才會安裝 TypeScript、Vitest、ESLint 等開發工具。單純瀏覽現有 2D／3D 仍**不需要 Neon、Google 登入或 API Key**；執行資料庫 Migration、Seed 或伺服器端目錄 API 時才需要後端 DATABASE*URL，且**不得**使用 VITE* 前綴。

## 檔案架構

- `src/features/auditoriums/schema.ts`：Zod 資料驗證與跨欄位檢查。
- `src/features/auditoriums/tfai-small.json`：小影格的來源資料與估算幾何。
- `src/features/auditoriums/spot-taipei.json`：光點台北的官方 83 席座位編號與估算幾何。
- `src/features/cinemas/chain-directory.ts`：40 個四大品牌商業連鎖影城分館與官方來源，和影廳／座位模型分層維護。
- `src/features/cinemas/vieshow-halls.ts`：威秀 2026 年官方逐廳座位數快照（229 筆）。
- `src/features/cinemas/other-chain-facts.ts`：秀泰、美麗華、美麗新官方公開的影廳總數、局部區域、特色格式及美麗華逐廳席數，保留數值所屬範圍與來源，不包含座號、3D 幾何或售票庫存。
- `src/features/auditoriums/directory.ts`：既有 9 間影廳、別名搜尋及資料可信度分級。
- `api/screenings.ts` 與 `src/features/screenings/`：文化部電影開放資料的唯讀 API、場次正規化與前端查詢頁。
- `src/features/auditoriums/demo.ts`：虛構示範影廳。
- `src/features/auditoriums/catalog.ts`：只有確實有 3D 模型的可選座清單（含 DEMO）；其餘影廳只顯示官方資訊。
- `src/features/auditoriums/geometry.ts`：座位座標與視角計算。
- `src/features/viewer/`：3D 場景、Viewer UI、相機。
- `src/components/SeatMap.vue`：依座標產生的 2D 座位圖。
- `src/stores/viewer.ts`：選位及相機模式。
- `docs/auditoriums/`：各影廳官方來源、精度與使用限制。
- `public/schemas/`：對外可讀取的 JSON Schema。

單位統一為公尺，Y 軸向上，銀幕位於 z=0、面向 +Z；各座位坐標由同一套資料產生。新增真實影廳時，須同時附上來源、查證日期及官方／估算欄位標記。

## 分支與 CI

- `develop`：Dev，日常功能整合（功能 PR 經 Squash Merge）。
- `staging`：UAT，只接受 `develop` 晉升 PR（使用 Merge commit）。
- `main`：Production，只接受 `staging` 晉升 PR（使用 Merge commit）。
- GitHub Actions 僅在 PR／手動觸發；純文件 PR 不安裝依賴，合併後不重跑 CI。
- Vercel 採單一專案：`develop`（Dev Preview）、`staging`（UAT Preview）、`main`（Production）；功能分支不自動部署，純文件變更跳過建置。
- Vercel `vercel.json` 支援 Vue Router 深層網址（SPA Rewrite），UAT 人工驗收後才晉升正式環境。

完整分支保護、GitHub Runner／Vercel 節流與發布規則請見 [分支與 CI 規範](docs/branching-ci.md)。

## 後續

Neon PostgreSQL + Drizzle 的資料表、Migration、Seed 與開發／UAT 資料庫已建立，操作及安全說明見 [資料庫文件](docs/database.md)。文化部場次目前仍由**即時唯讀 API**提供；已新增受控的 `develop` 歷史場次同步 CLI（預設不寫入），但尚未執行真實寫入／定時排程。後續依 [TODO.md](TODO.md) 完成開發庫實跑與重跑驗證、取消／來源更新規則、Google 登入、私人觀影紀錄（電影、日期、影城、影廳、座位）及 PWA 正式部署。
