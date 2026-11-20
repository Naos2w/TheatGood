# TheatGood Beta — 媒體與品牌素材權利檢查（2026-11-20）

> 用途：這是 **P0 發布門檻清單**，不是法律意見或授權證明。只盤點目前 App 會使用的媒體與商標素材；不修改已驗收的視覺設計。**有來源 URL 不等於擁有重新散布或商標使用權**。

## 1. 影片（已有明確公開授權）

- **作品：** _The Daily Dweebs_（Blender Foundation，2017）。
- **原始來源：** https://commons.wikimedia.org/wiki/File:The_Daily_Dweebs_-_Blender_Open_Movie-full_movie.webm
- **授權：** Creative Commons Attribution 4.0 International (CC BY 4.0)，https://creativecommons.org/licenses/by/4.0/
- **實作：** 桌面使用 Wikimedia Commons 公開 VP9 1080p 轉碼串流；Apple 裝置使用 TheatGood 本機 H.264/AAC 720p 相容轉碼，沒有剪輯故事內容。
- **目前署名：** 3D Viewer 的 `i` 資訊面板顯示作品名、Blender Foundation、Wikimedia 來源、CC BY 4.0 連結及 Safari 轉碼說明。
- **可用性判斷：** 可依 CC BY 4.0 條件使用與轉碼，須持續保留署名、授權連結及修改聲明；不得暗示 Blender Foundation 背書或合作。公開發行時再次檢查實際打包影片及頁面署名一致性。
- **原始影片不是影城授權的現場影片。** 影片僅供概念視角展示。

## 2. 商場與院線圖示（權利未確認）

下列 19 個**獨立資產**已在 `src/features/cinemas/cinema-discovery-metadata.ts` 記錄來源；路徑皆有對應檔案。網站上可查到的 Logo 或 App icon **不因此自動獲得再利用許可**。包含 App Store、第三方網站與使用者上傳的素材，均須在正式對外發布前個別確認權利或改採無圖片的文字識別。

| 資產                            | 來源證據                                                                           | 發布審核                 |
| ------------------------------- | ---------------------------------------------------------------------------------- | ------------------------ |
| `/malls/lalaport-mark.png`      | https://seeklogo.com/vector-logo/445083/lalaport                                   | 待確認                   |
| `/malls/mitsui-outlet-mark.png` | https://www.cathaypacific.com/cx/zh_TW/our-partners/mitsui-outlet-park-taiwan.html | 待確認                   |
| `/malls/tsmall-mark.png`        | https://www.hotel-tainan.com.tw/jp/spot/ins.php?index_id=69&index_m_id=11          | 待確認                   |
| `/malls/qsquare-app.png`        | https://apps.apple.com/tw/app/id1182868124                                         | 待確認                   |
| `/malls/yulon-square.png`       | https://apps.apple.com/tw/app/id6449417323                                         | 待確認                   |
| `/malls/megacity-square.png`    | `user-upload:2026-11-17-megacity`                                                  | 確認上傳者是否有授權轉載 |
| `/malls/globalmall-square.png`  | https://apps.apple.com/tw/app/id1095134873                                         | 待確認                   |
| `/malls/tonlin-square.png`      | https://apps.apple.com/tw/app/id1462854530                                         | 待確認                   |
| `/malls/geleven-square.png`     | https://groupg.org/wp-content/uploads/2024/09/--1024x835.png                       | 待確認                   |
| `/malls/shangshun-mark.svg`     | https://www.ss-plaza.com.tw/wp-content/uploads/2024/05/logo_color.svg              | 待確認                   |
| `/malls/feds-symbol-square.png` | https://www.feds.com.tw/                                                           | 待確認                   |
| `/malls/bigcity.ico`            | https://www.febigcity.com/                                                         | 待確認                   |
| `/malls/topcity.png`            | https://www.topcity.com.tw/                                                        | 待確認                   |
| `/malls/ifg-square.png`         | `user-upload:2026-11-17-ifg`                                                       | 確認上傳者是否有授權轉載 |
| `/malls/focus-logo.svg`         | https://www.focusquare.com.tw/                                                     | 待確認                   |
| `/malls/paradiso-square.png`    | `user-upload:2026-11-17-paradiso`                                                  | 確認上傳者是否有授權轉載 |
| `/malls/tigercity-mark.png`     | https://www.tigercity.com.tw/                                                      | 待確認                   |
| `/malls/taimall-app-logo.png`   | https://www.taimall.com.tw/                                                        | 待確認                   |
| `/brands/vieshow-symbol.png`    | https://www.mitsui-shopping-park.com.tw/images/sidebar_info_4.jpg                  | 待確認                   |

**目前結論：0／19 項可由現有來源紀錄單獨證明已獲再散布授權。** 這不代表一定違法，也不代表只能移除；只是尚未取得足以通過正式發布門檻的證據。

## 3. 不增加架構的發版處置

1. Beta 私有測試：保留目前已驗收的 UI，不改動使用者選定的 Liquid Glass 樣式。
2. 發布前：優先核對商標／Logo 的官方使用指引及授權。無法確認時，使用既有的**中性位置圖示＋文字名稱 fallback**，不要將其他品牌 Logo 假冒商場標誌。
3. 確認公開影片頁面仍保留 Blender Foundation 著作權署名、Commons 原始來源、CC BY 4.0 授權及轉碼變更說明。
4. 只有經使用者確認 Beta 及既有 PR／UAT 發布流程後，才能公開正式版本；本檔不授權自動部署。

## 4. 驗收狀態

- 已完成：影片公開授權文字查證、目前 19 個資產來源對照、既有影片資訊頁署名核對。
- 尚未完成：19 個 Logo 的實際使用許可／商標指引核對，實體 iPhone Safari 與 Android 端視覺驗收。
- 不在本輪：申請商標授權、調整品牌圖示、部署 UAT／Production、建立自動監控或排程。
