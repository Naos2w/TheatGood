# TheatGood P2 — Neon Auth + RLS isolation verification (2026-11-20)

> 本文最初記錄 PR #47 的隔離分支實驗；當時 Dev 尚未啟用。**2026/11/20 後續已完成 Dev Auth／Data API／RLS 配置與 A/B 實測**，見以下「Dev 啟用紀錄」。Staging／Main、正式使用者登入介面與資料匯入仍未啟用。

## Dev 啟用紀錄（2026-11-20，接續 PR #47）

**本階段已在既有 Neon `develop` 分支實際執行，非僅設計或 Scratch 模擬。**

- 確認 MSI `.env` 對應 TheatGood **Dev** 的 Neon 計算端點，從最新 `develop` 的 Drizzle Migration 正規執行 `npm run db:migrate`，以資料庫**直連而非 Pooler**完成 `0002_easy_spot`。現有 Drizzle Migration 表有 3 筆紀錄，五個新增的 `watch_logs` 欄位已確認存在，沒有改動 Staging／Main。
- 在 Neon **Dev** 啟用 Managed Better Auth（Better Auth）。Google 使用 Neon `shared` OAuth 供應者；禁用電子郵件／密碼登入與註冊。允許 localhost 開發測試；正式 Dev 網域尚未加入 trusted origins。
- 在同一 Neon Dev 分支建立 Data API，`add_default_grants=false`，`db_schemas=['public']`，JWT 由 Neon Auth 驗證。**只有 `public.watch_logs` 授予 `authenticated` 角色 SELECT／INSERT／UPDATE／DELETE；`anonymous` 不具有該表權限。** 禁止把其他 public、auth、neon_auth 資料表公開。
- 直接執行已提交的 `db/security/watch-logs-rls.sql`，並用唯讀查詢確認 `ENABLE`＋`FORCE ROW LEVEL SECURITY`、4 條 owner-scoped Policy，以及 `user_id DEFAULT auth.user_id()`。此 SQL 尚未被納入 Drizzle 的自動 Migration；後續正式環境必須分階段部署 Auth／Data API／SQL，不可在沒有 Auth 的分支套用。
- 在**真實 Dev API** 用兩個 `@example.com` 臨時測試身分取得不同 JWT，驗證：匿名和無效 JWT 拒絕；A／B 各自可 INSERT／SELECT／UPDATE／DELETE 自有記錄；B 看不到／不能修改刪除 A；B 冒用 A 的 `user_id` 得 HTTP 403；反向 A 看不到 B。測試列已清除，`watch_logs` 回到 **0 筆**。兩個純測試 Auth 身分保留在 Dev，已禁用其 email/password 登入路徑。
- Google OAuth 只完成**啟動跳轉**驗證：`POST /sign-in/social` HTTP 200，後續 `/sign-in/social/init` HTTP 302 指向 `accounts.google.com`。**尚未進行 Google 帳號實際登入、callback、session 恢復／登出或跨裝置 UI 驗收**，也未匯入任何本機觀影記錄。
- 已在目前可連的 Vercel 帳戶／團隊查詢 TheatGood Project，但尚**無法取得對應專案或 Dev 站點 URL**；不據此推斷專案不存在。正式 Dev URL、Google OAuth trusted origin、瀏覽器驗收和 Liquid Glass 登入／同步 UI 預覽仍是下一階段。不得因 Dev 後端已通過 A／B 測試而宣稱產品已登入或已同步。
- 依原規則，**不自動啟動 4184、Tailscale 8444、排程服務；不晉升 `staging` 或 `main`。**

## 1. Confirmed remote setup — PR #47 的歷史隔離實驗

The existing Neon project has a develop branch and database named theatgood. Before this work, that branch had **no Managed Better Auth, no Data API, and RLS disabled** on public.watch_logs. Do not attach a browser client to that table until the complete security setup passes.

We created a scratch branch from develop only for this test:

- Neon project: TheatGood; scratch branch name: scratch-p2-auth-isolation-20261120.
- Managed Better Auth: enabled on the scratch branch only, with its own issuer and user tables. Google is listed as a **shared development OAuth provider**; this does not prove production Google OAuth configuration or any interactive Google sign-in.
- Data API: enabled on that same scratch branch with add_default_grants=false.
- Existing nullable five-field history migration was exercised on scratch, without modifying actual develop.
- RLS: ENABLE and FORCE on public.watch_logs; SELECT/INSERT/UPDATE/DELETE policies for authenticated ownership only, via auth.user_id(); anonymous permissions revoked. user_id defaults to auth.user_id() so the client need not (and must not) set an owner.
- The executable SQL definition lives in db/security/watch-logs-rls.sql. It requires the preceding five-column Drizzle migration and Auth/Data API to be enabled **on the same target branch**. Do not apply it to staging or production automatically.

## 2. Real authenticated A/B smoke results

Ran actual HTTP requests against the scratch branch's Managed Better Auth and Data API, using two randomly generated **test-only** accounts with reserved example.com email addresses (not the user's Google identity). Received JWTs from Auth; all requests were made with independently issued tokens. No tokens, passwords or session cookies were printed or added to Git.

| Operation                               | Observed result                                     |
| --------------------------------------- | --------------------------------------------------- |
| Anonymous SELECT                        | HTTP 401                                            |
| A creates its own row, omitting user_id | Success; server-set user_id matched A's JWT subject |
| B SELECT A's row                        | HTTP 200 with zero rows                             |
| B tries to INSERT with A's user_id      | HTTP 403                                            |
| B attempts UPDATE / DELETE of A's row   | Zero rows affected; A's original row unchanged      |
| A deletes its own test row              | Success; test row removed                           |

This proves scratch-branch JWT validation and database row isolation for the tested paths. It does **not** prove Dev/Production is already configured, or that Google's interactive redirect was tested.

## 3. Repository changes

- src/features/history/cloud-history-wire.ts: parse and validate complete REST records, refuse mismatched owners and ensure insert/update payloads **never include user_id**.
- src/features/history/private-neon-gateway.ts: an on-demand SDK adapter with Neon Auth session restore, Google OAuth entry, logout, owner-scoped read, consent-based import, optimistic revision checks and explicit deletion confirmation. This is **not yet attached to the UI**.
- db/security/watch-logs-rls.sql: separate branch-scoped access policy; do not turn this into a blanket grant on every public table.
- .env.example: public branch-specific URLs only; database passwords and OAuth client secrets must remain server-side.
- The current browser localStorage history keeps operating as before; no automatic cloud upload or wiping of local data.

## 4. PR #47 原始推進清單（歷史紀錄；Dev 部署已完成第 1–4 步的後端部分）

1. Apply db/migrations/0002_easy_spot.sql through the repository's **Drizzle migration workflow** to the authorised Neon develop database; do not manually duplicate its DDL and bypass the migration journal.
2. Provision Managed Better Auth and the Data API on that SAME develop branch (with **no blanket/default grants**). Confirm Auth issuer and Data API branch identity. Configure localhost and Google OAuth origins as appropriate. Production Google sign-in requires approved provider credentials and redirect configuration.
3. Review and apply db/security/watch-logs-rls.sql after Auth/Data API exist. Confirm RLS and grants with a read-only metadata query.
4. Re-run actual anonymous/A/B tests against that develop branch, with synthetic accounts and no real personal data. Verify cookies, the Google login redirect, logout and restored sessions from a real browser once UI design has been approved.
5. Only after security acceptance, prepare the existing Liquid Glass UI login/backup/restore affordance for review. **Obtain the user's design approval before a meaningful UI change.** Migration of existing localStorage data must remain explicit opt-in, with conflict resolution and recoverability.
6. Keep staging/main unchanged until a numbered release candidate has completed its own user acceptance and security tests.

### MSI test environment note

The MSI inherited `NODE_ENV=production`, which makes Vue Test Utils load the Vue production runtime and causes three existing `SeatMap.test.ts` tests to fail with a null `refs` error. Running Vitest with **only that process** set to `NODE_ENV=test` passes the full suite (38 test files). This is a runtime environment distinction, not a reason to alter the machine-wide environment or the seat-map implementation.

### Security boundary

A client-side user ID or filtered SELECT is not permission evidence. The Neon Data API verifies a branch-issued JWT and PostgreSQL RLS uses auth.user_id() to restrict all four operations. Treat this as the actual access-control layer. Never expose a database owner connection string or service secret to Vite/browser code.

No persistent preview service, scheduled task, payment or external booking was created by this work.
