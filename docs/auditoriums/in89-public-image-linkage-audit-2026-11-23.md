# in89 官方圖片來源現況複核（2026-11-23）

> **來源連結可用不等於座位排列已核實。** 本研究只核對已保存的官方圖片是否仍存在，以及目前公開分館頁面是否仍可看到同一張舊圖。沒有新增任何 3D 座圖、相對座標或場次訂票資料。

## 方法

- 原始研究檔：`docs/research/theatgood-2026-11-18/in89_official_image_hall_capacity_2026-11-18.json`，含 **6 分館、54 筆逐廳公布席數**及當時取得的圖片 SHA-256。
- 在 MSI 以**無登入 Node.js HTTP GET**重新取得六張已知業者圖片；僅在記憶體計算 SHA-256，不保存／改寫圖片或座位內容。
- 以**獨立的無登入 Chrome**重新開啟六個已知官方分館頁，等待 DOM 載入並捲動後查詢 `img.currentSrc/src` 是否出現原始 2022 年檔名。只記錄網頁狀態、標題與該檔名是否在被查詢的 img 節點內；**不是完整網站、CSS 背景圖、前端程序或用戶登入後選位流程的全域檢索**。

## 結果

| in89 分館  | 已存容量項目 | 原始圖片 HTTP | 舊 SHA-256 是否完全一致 | 舊圖檔名出現在這輪渲染的 `img` DOM |
| ---------- | -----------: | ------------- | ----------------------- | ---------------------------------- |
| 桃園站前   |            8 | 200           | 是                      | **未觀察到**                       |
| 高雄鹽埕   |            7 | 200           | 是                      | **未觀察到**                       |
| 澎湖昇恆昌 |            7 | 200           | 是                      | **未觀察到**                       |
| 台中豐原   |           12 | 200           | 是                      | **未觀察到**                       |
| 高雄大立   |           11 | 200           | 是                      | **未觀察到**                       |
| 嘉義影食匯 |            9 | 200           | 是                      | **有觀察到**                       |
| **合計**   |       **54** | **6／6 成功** | **6／6 一致**           | **1／6 直接觀察到**                |

六個官方分館頁面 HTTP 也均回報 200，頁面標題與既存分館名稱對應。歷史圖片檔名均含 **202204**，所以圖片仍可下載**不代表官方 2026 年仍以這個檔案標示影廳最新配置**。尤其前五館沒有在這輪的 `img` DOM 查詢中出現舊圖，不能單靠可下載網址就把 2022 年席數當成當前影廳座位配置；但也不能藉此斷言已改裝或舊圖片一定未使用（例如圖片可能位於 JS、CSS 或其他頁）。

## 對 TheatGood 的約束

- **54 筆維持 `published-count-only` 的歷史研究層級，不升格為已核實目前完整座位格線。** 不能用 2022 照片的席數補座椅行列／走道，也不推測當前已存在的廳總數。
- 所有六館的完整逐排座號格線仍為 **0**；沒有可以增加來源支持的 3D 預覽。
- 對於未在公開分館頁面直接觀察到的舊圖片，補取資料時應優先查現行營運商廳別列表、每場次來源、業者允許的完整選位預覽或向業者取得正式座圖；取得後需透過 `chain-seat-evidence.ts` 驗證品牌、官方來源、廳號、完整座號／格線與隱私排除，並再經獨立審查。
- 此輪**沒有**登入會員、操作劃位、付款、讀取票況／Cookie／身份資訊，也沒有下載或複製官方影像進 Git。暫時檢查腳本只保存在 MSI 的 `.tmp/`。
- 沒有修改 `src/features/cinemas/data/additional-chain-published-seats-2026-11-18.json`、影廳總數、3D UI 或 `main` 正式版。

**English:** All six archived in89 operator image URLs still return byte-identical 2022 content. Only the Chiayi page showed the archived filename in its current image DOM during this bounded check; the other five are unconfirmed. None of the 54 historical capacity records establishes a current complete seat grid, so no new 3D scenes were added.
