# TheatGood｜連鎖影城公開來源補齊（2026-11-22）

## 範圍

這輪處理「已有公開影城或席數資料、但尚未進入 App」的連鎖院線，**不以席數推估 3D 座位格線**。原 4 品牌 40 分館新增 5 品牌 26 分館，現在目錄共 **9 品牌、66 間分館**。

| 新增品牌              | 已記錄分館 | 公開影廳席數紀錄 | 完整來源座圖 |
| --------------------- | ---------: | ---------------: | ------------ |
| 國賓 Ambassador       |          9 |               81 | 0            |
| in89                  |          6 |               54 | 0            |
| 百老匯 Broadway       |          2 |               25 | 0            |
| 喜樂時代 Century Asia |          4 |               62 | 0            |
| 新光 Shin Kong        |          5 |                0 | 0            |
| 合計                  |     **26** |          **222** | **0**        |

上述分館與席數的研究日期是 2026-11-18，**並未再次確認現在是否營業**。部分 in89 靜態席數圖片的檔名包含 2022 年份；最新配置需再向業者查證。分館頁已加入歷史資料提醒、官方資訊來源連結，沒有臆測場次、GPS 座標或座位。

## 可供後續建模的資料分類

- 現在可操作的 3D 預覽維持 **393 個**：威秀／MUVIE 222 份、秀泰 158 廳、美麗新 13 種來源座型（其永久實體廳號仍有待確認）。
- 3D 圖鑑的「待補完整座圖」目前按 **6 品牌／27 間分館**分組收合：本輪 26 間加上原有美麗華大直。可展開分館研究資料及已有的個別影廳席數，但**沒有假的 3D 按鈕**。
- 本輪新增的 222 筆是公開席數或總座位位置數，非逐排、逐號的座標。每筆安全註記 seatGridVerified=false；不得升格為已完成 3D。
- 已查證的 40 條舊時刻表連結保留，26 新分館不會自動捏造訂票或場次深層連結。
- 26 新分館尚無可核對的 GPS 點位；附近排序會將其置於座標已查證的分館之後。

## 檔案與重建

只將來源已整理好的公開研究 metadata 寫入程式，不提交私有會員座位格線：

- scripts/research_publish_additional_chain_branches.mjs
- scripts/research_publish_additional_chain_seat_counts.mjs
- src/features/cinemas/data/additional-chain-branches-2026-11-18.json
- src/features/cinemas/data/additional-chain-published-seats-2026-11-18.json

產生器需通過 26 分館來源驗證、官方網址白名單、222 筆獨立影廳席數、唯一廳號及「所有座位格線均未驗證」斷言，才能更新公開 metadata。完整來源研究檔仍留在 MSI 本地。

## 驗收與限制

已透過 MSI Tailscale 10000 的實際 HTTPS 網址，以隔離 Chrome 在手機及桌面測試分館篩選、國賓/in89/百老匯/喜樂時代的官方席數、新光無席數的保守提示、3D 圖鑑 222/158/13 及待補六組折疊、手機無水平溢出；新功能 JS runtime errors=0。

既有私人預覽中的 /api/screenings 會回傳 404，屬先前的電影場次 API，與這輪座圖及新增分館無關，應作為後續獨立修正項目。

未新增任何私有秀泰座圖到公開建置；沒有公網 Funnel、Push、Merge、正式部署或操作秀泰會員 Chrome。

English: Public historical records for 26 additional chain venues and 222 published hall capacities are now available as research-only information. The 393 existing sourced 3D previews remain intact. Seat layouts are never guessed from capacities.
