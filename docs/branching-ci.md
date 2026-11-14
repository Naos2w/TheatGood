# TheatGood — 分支、CI 與發布策略

> 最小化 Actions 次數：僅 PR／手動觸發，無 push、schedule、矩陣測試或自動發布。

## 長期分支與對應環境

| 長期分支  | 用途                    | 從哪裡進入                              | 使用者驗收              | 部署           |
| --------- | ----------------------- | --------------------------------------- | ----------------------- | -------------- |
| `develop` | DEV：日常開發整合       | `feature/*`、`fix/*`、`chore/*` 等 → PR | 開發自測                | 未設定自動部署 |
| `staging` | UAT：準備驗收的穩定候選 | **`develop` → PR**                      | 人工驗收後才准進 Prod   | 未設定自動部署 |
| `main`    | PROD：正式版本原始碼    | **`staging` → PR**                      | 以已通過 UAT 的候選發布 | 未設定自動部署 |

`main` 保留為 GitHub 預設分支（方便發行與手動執行 Workflow），不要直接在 `main` 開發。**CI 通過不是 UAT 通過，也不等於已部署**。目前沒有串接 Vercel、Neon 或任何正式環境，故上述 Dev/UAT/Prod 為程式版本的預期角色，尚非已上線網址。

### 一般開發到正式發布

1. 從 `develop` 切出 `feature/my-feature`（或 `fix/...`），在此提交任意數量的 commits 和 pushes。
2. 開 PR `feature/my-feature → develop`。CI 首次執行完整必要檢查；同一 PR 新 commit 會取消過時執行。檢查通過後使用 **Squash merge**，便於追蹤一項功能一個 commit。
3. 需要 UAT 時開 `develop → staging` 的 PR。CI 檢查同一份候選程式碼。通過後使用 **Merge commit**（不要 squash），保留真正的祖先關係，避免下次 UAT PR 重複列出先前功能。
4. 在 `staging` 驗收 3D Viewer、座位圖、手機操作與新功能。驗收結果及發布決定由人確認，**CI 不會自行決定 UAT 通過**。
5. UAT 通過後開 `staging → main` 的 PR。CI 再確認正式發布版本。通過後使用 **Merge commit**（不要 squash），保留環境晉升歷史。
6. 發布／回滾是獨立 CD 工作；本版 CI 不會自動部署，不會在合併後再次測試。未來如需 Vercel，會另外設定各分支對應的 Dev、UAT 與 Production 部署。

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

不會啟用以下項目：Push CI、每日／每週定時檢查、Pull Request Label 觸發、Matrix、依賴掃描的每次 PR 自動執行、每次合併後額外 Build、任何未經授權的自動部署。

## 下一步（獨立於本輪 CI）

- 真正部署 Dev/UAT/Prod 時，才在 Vercel 建立分支對環境的對應、變數與 Production 發布規則，避免一個 Repo 多個預覽自動部署消耗 Vercel 限額。
- Neon 連線、登入及觀影紀錄屬於後端功能階段；CI 的品質檢查不需要 Neon 憑證。
