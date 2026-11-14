# TheatGood

**台灣影廳 3D 座位視角預覽與個人觀影紀錄 App**

以 Vue 3 / TresJS 開發，從台灣影廳的公開資料建立 3D 模型、座位圖與第一人稱視角。未來再整合真實放映場次與個人觀影紀錄；**不做評分、心得、社群或即時訂票**。

## 目前可使用（P0）

- **國家電影及視聽文化中心「小影格」**：官方設備手冊提供 **8.88 × 4.80 m** 銀幕、**52 席**座位圖（另有 2 輪椅席，尚未建模），可進入 3D 模型選位。
- **TheatGood 示範影廳**：114 席完全虛構模型，供調整 3D 視角及座位引擎之用。
- 座位 2D / 3D 共用 X 座標與座號，選位可切換第一人稱或自由視角。
- 顯示與銀幕的估算距離、水平／垂直視角與偏移角。
- 支援桌機及手機尺寸；WebGL 2 不支援時可保留 2D 座位選擇。

**資料準確度：小影格的銀幕尺寸、總席數與座號有官方來源；座距、坡度、銀幕底緣高度、曲率、人眼高度及牆面等仍屬估算。** 模型不等於現場視野，亦不提供售票座位庫存。詳細紀錄請見 [小影格資料來源](docs/auditoriums/tfai-small.md)。

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

若全域 npm 設定了 `omit=dev`，使用 `npm install --include=dev` 才會安裝 TypeScript、Vitest、ESLint 等開發工具。目前**不需要 Neon、Google 登入或 API Key**。

## 檔案架構

- `src/features/auditoriums/schema.ts`：Zod 資料驗證與跨欄位檢查。
- `src/features/auditoriums/tfai-small.json`：小影格的來源資料與估算幾何。
- `src/features/auditoriums/demo.ts`：虛構示範影廳。
- `src/features/auditoriums/catalog.ts`：可選擇的影廳目錄。
- `src/features/auditoriums/geometry.ts`：座位座標與視角計算。
- `src/features/viewer/`：3D 場景、Viewer UI、相機。
- `src/components/SeatMap.vue`：依座標產生的 2D 座位圖。
- `src/stores/viewer.ts`：選位及相機模式。
- `docs/auditoriums/`：各影廳官方來源、精度與使用限制。
- `public/schemas/`：對外可讀取的 JSON Schema。

單位統一為公尺，Y 軸向上，銀幕位於 z=0、面向 +Z；各座位坐標由同一套資料產生。新增真實影廳時，須同時附上來源、查證日期及官方／估算欄位標記。

## 後續

Neon PostgreSQL + Drizzle、合法的台灣影城場次同步、Google 登入、私人觀影紀錄（電影、日期、影城、影廳、座位）、歷史補登與 PWA 正式部署，將依 [TODO.md](TODO.md) 逐步實作。
