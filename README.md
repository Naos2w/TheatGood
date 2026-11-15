# TheatGood

**台灣影廳 3D 座位視角預覽與個人觀影紀錄 App**

以 Vue 3 / TresJS 開發，從台灣影廳的公開資料建立 3D 模型、座位圖與第一人稱視角。未來再整合真實放映場次與個人觀影紀錄；**不做評分、心得、社群或即時訂票**。

## 目前可使用（P0 + v2 UI）

- **國家電影及視聽文化中心「小影格」**：官方設備手冊提供 **8.88 × 4.80 m** 銀幕、**52 席**座位圖（另有 2 輪椅席，尚未建模），可進入 3D 模型選位。
- **光點台北電影館「光點電影院」**：官方座位圖 **83 席（含可置換的輪椅席）**、銀幕 **4.70 × 1.85 m**，保留原始 `1-1`～`9-9` 座號及中央走道；3D 排距仍為估算。
- **官方影廳目錄**：首批 5 座場館／9 間影廳，其中只有 2 間座位資料足夠提供 3D。其餘只顯示可查證的規格，不杜撰座位圖。
- **附近影城探索**：支援關鍵字、地區、3D 可用性篩選；按一下定位按鈕、授權瀏覽器定位後，可按場館的直線距離排序（非交通時間）。不要求定位即可搜尋，座標來源可追溯；定位只在瀏覽器本頁使用。
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
```

若全域 npm 設定了 `omit=dev`，使用 `npm install --include=dev` 才會安裝 TypeScript、Vitest、ESLint 等開發工具。單純瀏覽現有 2D／3D 仍**不需要 Neon、Google 登入或 API Key**；執行資料庫 Migration、Seed 或伺服器端目錄 API 時才需要後端 DATABASE_URL，且**不得**使用 VITE_ 前綴。

## 檔案架構

- `src/features/auditoriums/schema.ts`：Zod 資料驗證與跨欄位檢查。
- `src/features/auditoriums/tfai-small.json`：小影格的來源資料與估算幾何。
- `src/features/auditoriums/spot-taipei.json`：光點台北的官方 83 席座位編號與估算幾何。
- `src/features/auditoriums/directory.ts`：9 間影廳、別名搜尋及資料可信度分級。
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

Neon PostgreSQL + Drizzle 的資料表、Migration、Seed 與開發／UAT 資料庫已建立，操作及安全說明見 [資料庫文件](docs/database.md)。接下來將依 [TODO.md](TODO.md) 逐步實作合法的台灣影城場次同步、Google 登入、私人觀影紀錄（電影、日期、影城、影廳、座位）、歷史補登與 PWA 正式部署。
