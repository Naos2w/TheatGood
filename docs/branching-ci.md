# TheatGood — 分支、CI 與發布策略

> 最小化 Actions 次數：GitHub CI 僅 PR／手動觸發；Vercel 只部署三個長期分支，不在功能分支建置。

## 長期分支與對應環境

| 長期分支  | 用途                    | 從哪裡進入                              | 使用者驗收              | 部署                  |
| --------- | ----------------------- | --------------------------------------- | ----------------------- | --------------------- |
| `develop` | DEV：日常開發整合       | `feature/*`、`fix/*`、`chore/*` 等 → PR | 開發自測                | Vercel Preview（Dev） |
| `staging` | UAT：準備驗收的穩定候選 | **`develop` → PR**                      | 人工驗收後才准進 Prod   | Vercel Preview（UAT） |
| `main`    | PROD：正式版本原始碼    | **`staging` → PR**                      | 以已通過 UAT 的候選發布 | Vercel Production     |

`main` 保留為 GitHub 預設分支，不要直接在 `main` 開發。**CI 通過不是 UAT 通過，也不等於已部署**。Vercel 透過同一專案的 Git 整合部署這三個分支；實際網址及 READY 狀態以 Vercel 部署紀錄為準。Neon 尚未整合。

### 一般開發到正式發布

1. 從 `develop` 切出 `feature/my-feature`（或 `fix/...`），在此提交任意數量的 commits 和 pushes。
2. 開 PR `feature/my-feature → develop`。CI 首次執行完整必要檢查；同一 PR 新 commit 會取消過時執行。檢查通過後使用 **Squash merge**，便於追蹤一項功能一個 commit。
3. 需要 UAT 時開 `develop → staging` 的 PR。CI 檢查同一份候選程式碼。通過後使用 **Merge commit**（不要 squash），保留真正的祖先關係，避免下次 UAT PR 重複列出先前功能。
4. 在 `staging` 驗收 3D Viewer、座位圖、手機操作與新功能。驗收結果及發布決定由人確認，**CI 不會自行決定 UAT 通過**。
5. UAT 通過後開 `staging → main` 的 PR。CI 再確認正式發布版本。通過後使用 **Merge commit**（不要 squash），保留環境晉升歷史。
6. GitHub CI 不會在合併後重跑；Vercel 對合併後的長期分支做一次部署建置。Production 必須經過 `staging` 的人工 UAT 確認才能晉升至 `main`。部署／回滾由 Vercel 管理，不在 GitHub Runner 額外重建。

**緊急修復：** 先將修復 PR 合併至 `develop`，經過 `staging` UAT，再進 `main`。目前沒有繞過 UAT 的熱修捷徑。

## 實際 GitHub Actions 觸發條件

唯一的 [.github/workflows/ci.yml](../.github/workflows/ci.yml) 使用固定且可設定為必填狀態檢查的 **`quality`** Job。

| 事件                                            | CI 行為                                  | 套件安裝                | 費用與時間考量                       |
| ----------------------------------------------- | ---------------------------------------- | ----------------------- | ------------------------------------ |
| PR → `develop`                                  | 驗證 PR 來源分支，再判斷修改檔案         | 只在非純文件變更時      | 合併後**不重跑**                     |
| PR `develop → staging`                          | 驗證 UAT 晉升方向，同樣依變更執行        | 只在非純文件變更時      | 需要 UAT 才發 PR                     |
| PR `staging → main`                             | 驗證正式發布來源，同樣依變更執行         | 只在非純文件變更時      | 需要發布才發 PR                      |
| 純 `*.md`、`README.md`、`TODO.md`、`docs/**` PR | `quality` 快速完成來源與路線檢查         | **不 checkout、不 npm** | 仍保留必填 Check，避免 Pending 卡 PR |
| Draft PR                                        | Job 不執行；改為 Ready for review 才啟動 | 無                      | 撰稿階段零編譯                       |
| `workflow_dispatch` 手動觸發                    | 完整檢查，可勾選額外正式依賴 `npm audit` | 是                      | 僅手動需要時                         |
| 直接 push、commit、合併完成、每日定時           | **不觸發**                               | 無                      | 避免重複運行                         |

所有非純文件 PR 的一個 Ubuntu Runner 執行：

```bash
npm ci --include=dev --no-audit --no-fund
npm run lint
npm run test
npm run build         # build 已包含 vue-tsc，不重複 typecheck
npm run format:check
```

只測 Node.js 24；不使用多 OS / Node 矩陣、不上傳 artifacts、不重複在 push 和 PR 檢查；啟用 npm Cache、12 分鐘逾時、同 PR 舊工作自動取消。Secrets 不供 Pull Request 測試使用。

純文件 PR 仍執行極短的 `quality` 检查，而非在 `on.pull_request.paths-ignore` 完全跳過 Workflow，因為 GitHub 的必填 Check 若被 path-filter 整體略過會停在 Pending，阻止正常合併。

## 合併規則與保護

- `develop`：開發 PR 允許任意非環境分支，請使用 **Squash** 合併；直接 push 應由 GitHub Ruleset 禁止。
- `staging`：CI 僅允許本 Repo 的 `develop` 當作 PR 來源；請使用 **Merge commit**。
- `main`：CI 僅允許本 Repo 的 `staging` 當作 PR 來源；請使用 **Merge commit**。
- 三個長期分支應設置 GitHub **Require pull request**、**Required status check: quality**（鬆散檢查，避免每次基底改動強制重新執行），且禁止 force push / 刪除。
- 單人開發不強制 PR 人工 Review 次數（0 位），但 UAT 是否通過仍需人為確認；不可用 CI 綠燈當成驗收簽核。
- 任何修改 CI Workflow 或程式碼的 PR 都會執行完整 npm 檢查。

> GitHub Ruleset 是否成功生效，應以 GitHub 設定及 REST API 實際讀取結果為準；若未開啟，以上為規劃而非強制保護。

## 免費額度與限制

TheatGood 目前為公開 Repo，GitHub 標準託管 Runner 的執行時間在現行政策下免費；未來若改成私有 Repo，帳號每月免費分鐘與使用量規則不同。即使免費，仍避免一個 commit 觸發多次執行。

不會啟用以下項目：Push **CI**、每日／每週定時檢查、Pull Request Label 觸發、Matrix、依賴掃描的每次 PR 自動執行，以及功能分支的 Vercel Preview。只有 Dev/UAT/Prod 的晉升合併會觸發 Vercel 部署建置；CI 與部署 Build 是不同用途。

## Vercel Git 部署與費用控制

- 單一 Vercel 專案：`main` 指向 Production；`develop`、`staging` 分別使用 Preview 分支部署，不建立三個獨立專案。
- `vercel.json` 的 `git.deploymentEnabled` 設定 `**: false`、`develop/staging/main: true`；所有匹配的明確 `true` 優先，因此功能分支 `feature/foo` / `fix/bar` **根本不建立部署**。
- `scripts/vercel-ignore-build.mjs` 若只改 Markdown、`docs/` 或 `.github/` 則略過編譯；但 **Ignored Build Step 仍可能計入 Vercel 部署次數／並行名額**，故主要節流依靠前述分支白名單。
- Vercel Production Branch 使用 GitHub 預設的 `main`；SPA Rewrite 讓 `/cinemas`、`/auditoriums/tfai-small` 等前端路由可直接開啟。
- **Hobby 的 `develop` / `staging` 目前都屬 Preview 環境**，不是兩個完全獨立的後端。未來加入 Neon/Auth 時須使用 Git branch 專屬的 Preview 環境變數或真正獨立的 DB 分支，不可混用正式個資。
- 只有 `staging` 通過使用者 UAT 後才能合併 `staging → main`。GitHub CI 不負責登入 Vercel，也不使用 Vercel Token。

Neon 連線、登入及觀影紀錄屬於後端功能階段；目前前端部署不需要 Neon 憑證。
