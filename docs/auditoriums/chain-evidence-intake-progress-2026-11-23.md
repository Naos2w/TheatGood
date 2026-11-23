# TheatGood｜連鎖影廳逐步補齊：來源驗證、實體尺寸、UAT 進度（2026-11-23）

> **狀態：研究流程與來源安全閘門已完成；其他院線的逐廳完整座圖仍受官方來源／會員權限限制，不能宣稱完成 3D。** 本輪沒有新建或公開任何未核實座位。上一輪已核實的 **394** 份來源 3D＝威秀/MUVIE 222＋秀泰 MSI 私人 159＋美麗新座型 13。394 是來源預覽數，不是實際測量過的永久實體影廳數。

## A. 依確認順序逐項處理

| 順序 | 影城／事項                         | 本輪已核對的實際證據                                                                                                                                                                                                                                                                           | 仍阻塞 3D 完成的必要證據                                                           |
| ---- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| P1-1 | 國賓 9 分館、81 筆公開席數         | [官方訂票首頁](https://booking.ambassador.com.tw/) 需會員登入；現行 [國賓看電影 App](https://play.google.com/store/apps/details?id=tw.com.langshin.moviefirst.droid) 提供會員劃位；舊 [網路劃位示例](https://booking.ambassador.com.tw/frontend/booking-selectseats.html) 不代表現行 2026 格線 | 經授權可讀、能直接對上**現行分館＋永久廳號**的完整座號與走道；尚未取得             |
| P1-2 | in89 6 分館、54 筆公開席數         | [官方 FAQ](https://www.in89cinemax.com/boomboom/question.aspx) 將選位放在會員訂票流程；[桃園站前官方分館](https://www.in89cinemax.com/theater_detail.aspx?Tdetail=1&TheaterId=1&id=1) 提供場館與舊圖片，但 2022 年圖片不足以核對當期逐座格線                                                   | 現行逐排座號、走道及來源廳號；尚未取得                                             |
| P1-3 | 美麗新台茂／大直皇家 13 種來源座型 | 台茂 **8 種**與現行官方座位數／輪椅號碼形成不重複的**高信心候選**，但不等於場次直接標示永久廳號；台茂第 **2、9、10** 廳未有格線。大直皇家 5 種：**2 個席數唯一候選、3 個仍有兩種廳號可能**                                                                                                     | 直接包含場次＋永久實體廳號的官方原始資料，否則 `physicalHallNumber: null` 不得改寫 |
| P2-1 | 百老匯 2 分館／25 筆席數           | [官方線上購票說明](https://www.broadway-cineplex.com.tw/bookInfo.html) 可訪問，只有交易規則；本輪未觀察到可直接審核的座位格線                                                                                                                                                                  | 完整官方逐廳格線                                                                   |
| P2-2 | 喜樂時代 4 分館／62 筆席數         | [官方 FAQ](https://www.centuryasia.com.tw/cinemaQA.html) 內有全省影廳**席數表**，不是座號位置矩陣；官方 App 宣稱提供視覺化選座                                                                                                                                                                 | 含廳號及走道的完整座位格線                                                         |
| P2-3 | 新光 5 分館／0 筆逐廳席數          | [官方網站](https://www.skcinemas.com/) 可訪問，這批歷史資料尚缺可核對的完整逐廳名錄與席數                                                                                                                                                                                                      | 先取得現行分館／影廳名錄，再取得各廳格線                                           |
| P2-4 | 美麗華 1 分館／10 筆逐廳席數       | [官方包廳頁](https://www.miramarcinemas.tw/Home/groupticket2) 可核對現行 10 個廳別席數；IMAX 在 2026-11-23 即時來源顯示 **373 席**（早期快取曾為 404）                                                                                                                                         | 尚無 IMAX／Dolby Cinema／一般廳逐座號格線，不能憑席數建模                          |

**讀取方式：** 在獨立、不帶個人登入資料的 Chrome 中只開啟上述 8 個已核對官方公開入口；HTTP 均為 200。這 8 個代表性入口的 DOM 未提供可直接匯入的已定位逐座號格線。這只是本輪「入口樣本檢查」，**不能據此斷言業者不存在任何其他可合法取得的格線**。暫時性檢查結果只放在 MSI 忽略追蹤的 `.tmp/public-chain-probe-20261123/`，沒有登入、選位、付款或猜測內部 API。

## B. 已完成的來源研究工作清單與閘門

新增 `src/features/cinemas/chain-seat-evidence.ts` 和對應單元測試，以及 `scripts/export-chain-seat-source-worklist.ts`。

- `npx tsx scripts/export-chain-seat-source-worklist.ts` 從 TheatGood **現有**分館／逐廳公開席數資料動態產生 **27 間待補分館／232 筆容量來源**及新光 **5 個缺逐廳名錄的分館工作項目**，共 **237 項研究任務**。輸出 JSON 與 CSV 到忽略追蹤的 `.tmp/chain-seat-source-worklist-20261123/`，**不是 237 間實體影廳**。
- 資料驗證器要求正式影城 slug 與品牌一致、來源必須是該業者 HTTPS 網域、場次／固定廳號可直接核對、座圖完整、座號及相對格線位置唯一且合理、時間可解析，不得保留售罄／空位、登入、付款或其他交易欄位。
- **結構驗證通過 ≠ 可上線。** 結果永遠是 `candidate-needs-independent-review`，不能自動升格 `seatGridVerified` 或建立 3D。會員來源明確標示私人研究專用，不輸出座圖、來源臨時 SessionId 或帳號資訊。
- 完整隔離測試涵蓋造假廳號、非官方網域、純席數對照、錯誤日期、重複座號／格線、夾帶票況及會員來源；測試案例是**合成資料**，不是新收集的國賓座位。

## C. 真實尺寸的證據與限制

- [美麗華官方 IMAX 技術介紹](https://www.miramarcinemas.tw/Home/imaxcinema) **直接公布弧形銀幕寬 28.4 m、高 20.54 m**；本輪 MSI 直接 HTTP 200 亦確認頁面出現這兩個數字。這是**官方公告的銀幕尺寸**，但美麗華沒有可信完整座位格線，因此不能轉成逐座位觀影位置。
- 現有威秀／MUVIE TITAN **22 × 12 m** 來源標示為業者公布；板橋 IMAX **21.33 × 11.46 m** 標示為獨立次級來源。兩者與固定影廳的綁定仍是**以席數交叉比對的候選**，並非個別測量過的座標或原廠樓層平面圖。
- 未取得可信來源的首排距離、排距、地板坡度、座椅高度及曲率，不得聲稱 3D 是毫米級或實測影廳。不能把 ScreenX 270° **三面環繞總幅寬**用作單面銀幕寬度。
- 其他廳仍標示估算；新資料必須逐欄具 `sourceUrl`、`observedAt`、`geometryField`、`identityConfidence` 與權利檢查才能用於校準。

## D. UAT 與實際設備

- 既有來源保護及 3D 介面已在 `staging` 維持，**此輪沒有新 3D 素材、UI 或正式會員資料**；用合成來源測試安全閘門，不改動正式版 `main`。
- Android 真機：在 MSI 與 PC2 以讀取方式查找 ADB／常見 SDK 位置；目前無法列出可連線的實體測試設備，因此**不能標記真機通過**。瀏覽器模擬裝置尺寸不等於 Android 手機實測。
- iPhone Safari：目前無法直接控制實體 iPhone 的 Safari／硬體喇叭及觸控，尚未完成本人真機簽核。
- 仍需真機驗證：音畫同步、Safari 有聲播放許可／背景靜音、45–95° 鏡頭與座位比較、返回 2D、直橫式 safe area、尾端手機 320px 觸控、Tailscale 私人資料隔離。
- 商標／商場 Logo 使用權利、19 個資產的最終授權核對與生產版發布批准另有既有待辦，**不是技術 CI 通過就可略過**。

## 完成判準

新院線要增加一個 3D 廳，必須依序具備：**當期官方可核對來源 → 完整座號與相對格線 → 走道與特殊位置 → 廳號證據／實體對應 → 來源快照及授權 → 單元與 WebGL／真機測試 → 正式分支審查**。否則維持「待補資料」，不猜測座椅排列、不自動發布，不算完成數。

**English:** The chain-cinema source intake and validation workflow is in place, but 27 branches still lack dependable seat-by-seat maps. Published capacities and screen dimensions must not be mistaken for complete measured 3D auditoriums. Real iOS/Android device UAT remains outstanding.
