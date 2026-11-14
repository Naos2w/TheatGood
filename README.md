# TheatGood

**台灣影廳 3D 座位視角預覽與個人觀影紀錄**

TheatGood 是以 Vue 3 / TresJS 建立的台灣影廳視角模擬 App。近期優先完成可參數化的 3D 影廳、2D 座位圖與第一人稱觀看視角；未來再接入真實台灣影城場次及個人觀影紀錄。

## 目前可試用的功能（P0 Demo）

- 首頁與影廳探索頁。
- 一個**虛構的示範影廳**：依幾何資料產生座位、走道、各排高差、銀幕。
- 2D / 3D 選位同步；點選座位切換第一人稱；可返回自由視角。
- 顯示距離銀幕、水平與垂直視角、中央偏移角（根據示範參數估算）。
- 手機版介面；WebGL 2 不支援時可繼續使用 2D 座位圖。

**請注意：示範影廳並非真實台灣影城的測量資料，也沒有連接正式放映場次或觀影紀錄。** 所有座位距離和視角都是數學模型估算，不能當成購票建議。

## 本機啟動

需要 Node.js 22.12+（建議 Node 24）與 npm。

```bash
npm install --include=dev
npm run dev
```

用瀏覽器開啟 Vite 顯示的網址（一般是 `http://localhost:5173`）。

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run format:check
```

若你的 npm 全域設定 `omit=dev`，必須使用 `npm install --include=dev` 才會安裝 TypeScript、Vitest、ESLint 等開發工具。示範版完全不需要 Neon、Google 登入或 API Key。

## 程式架構

- `src/features/auditoriums/`：影廳資料格式、示範模型與座位／視角幾何計算。
- `src/features/viewer/`：3D 場景、座位視角及 Viewer 頁面。
- `src/components/SeatMap.vue`：由同一份影廳資料產生的 2D 座位圖。
- `src/stores/viewer.ts`：目前座位與視角模式。
- `src/router/`：前端路由。
- `TODO.md`：P0～P3 功能規劃、資料可信度與驗收標準。

幾何座標統一使用公尺，Y 軸向上，銀幕放在 z=0 並朝 +Z；座位與觀眾沿 +Z 方向遠離銀幕。之後每個真實影廳都要記錄規格來源與實測／估算狀態。

## 規劃中

Neon PostgreSQL + Drizzle、台灣影城合法場次來源同步、Google 登入、私人觀影紀錄（電影、日期、影城、影廳、座位）、歷史補登、PWA、正式部署。

**不做**電影評分、心得、社群、即時訂票或座位庫存。

詳細待辦與驗收標準參考 [TODO.md](TODO.md)。
