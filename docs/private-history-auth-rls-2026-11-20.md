# TheatGood P2 — Neon Auth + RLS isolation verification (2026-11-20)

> Development-only implementation; not a Staging/Production release or live user data migration. No production or existing Neon develop database, Vercel, or OAuth credentials were modified by this verification.

## 1. Confirmed remote setup

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

## 4. Promotion checklist (not yet done)

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
