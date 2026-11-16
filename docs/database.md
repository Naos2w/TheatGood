# TheatGood — Neon database (P1.1)

## Environments and safeguards

- Neon project: **TheatGood** (Singapore / aws-ap-southeast-1, PostgreSQL 18). This project is separate from Naosledge.
- **main**: Production branch. No migrations, seed data or connection credentials applied yet; production promotion requires explicit approval.
- **develop**: Development branch, with the generated migration, official TFAI Small Cinema model and one clearly labelled fake screening.
- **staging**: UAT branch cloned from develop before test fixtures were added, with the same real auditorium but no fake screenings.
- Vercel secrets: only branch-specific Preview DATABASE_URL values for develop and staging. No Production DATABASE_URL is configured.
- Neon Free plan did not permit an additional protected branch; never treat main as read-only by policy alone.

## Files

- db/schema.ts: seven Drizzle tables, relationships, indexes, unique constraints and immutable model-version representation.
- db/migrations/: Drizzle Kit SQL migrations and snapshots; commit these to Git.
- db/seed.ts: idempotent, source-attributed seed for five official cinema venues/nine auditoriums. Only TFAI Small Cinema and SPOT Taipei have complete seat IDs and versioned geometry; model v1 is immutable.
- db/seed-fixture.ts: synthetic **development-only** screening with unknown auditorium (NULL). Explicitly not a real showtime.
- db/verify.ts: live database integrity and seat-coordinate smoke test.
- api/cinemas.ts: Vercel server-only, GET-only public catalogue (published auditoriums with current model metadata). No private tables or credentials are returned.

## Local commands

Copy .env.example to .env and set DATABASE_URL to the **direct develop** connection string from the Neon console. Never commit .env, .env.staging.local or real credentials, or prefix DATABASE_URL with VITE_.

    npm ci --include=dev
    npm run db:generate   # whenever db/schema.ts changes; review and commit SQL
    npm run db:migrate    # only against a verified non-production URL
    npm run db:seed       # safe to rerun; refuses to overwrite an existing model version with changed geometry
    npm run db:verify

To insert the one intentional synthetic test screening into the **develop** branch only, set THEATGOOD_ALLOW_FIXTURES=yes for one command invocation and run:

    npm run db:seed:fixture

Running this script without the explicit flag is rejected. The test screening has status=fixture, its title is marked NOT REAL and its auditorium_id remains NULL because a hall number was not supplied.

## Real showtime snapshots — manually gated develop import (P1.3)

The culture feed is still displayed live by `GET /api/screenings`. A separate CLI can now **optionally** preserve source observations in Neon **develop only**; this is not automatically deployed or scheduled. No new database tables or migrations are needed.

1. Default, **read-only, no DATABASE_URL required**: `npm run db:screenings:sync`. It retrieves the public culture feed and prints only counts and time bounds with `write:false`.
2. For an explicitly approved development import, supply a **direct** Neon `develop` connection string in the local `DATABASE_URL` environment variable (never commit it). Set `NEON_DEV_BRANCH_ID=br-super-mode-a1vmn1ny` and `THEATGOOD_ALLOW_SCREENING_SYNC=yes`, then run `npm run db:screenings:sync -- --write`. On PowerShell, set these as `$env:VARIABLE = 'value'` for the current session and clear the opt-in afterwards.
3. The CLI first checks the configured connection hostname against the verified **develop** compute endpoint, then inside a single PostgreSQL transaction checks `neon.branch_id` and `neon.endpoint_id`. It acquires an advisory transaction lock before any inserts.
4. `screening_sources(provider, source_key)` prevents duplicates. Re-seen records update their last fetched time, and corrected metadata updates the existing screening. New event times or hall labels are **new observations** because the culture feed has no stable screening-instance ID.
5. Missing events are **not automatically cancelled or deleted**: a partial or stale government feed cannot prove cancellation. Past rows remain available for later viewing-history features. No public write API, production connection, authenticated watch-log write, or Cron is added.

This script is covered by synthetic transaction tests and a live **read-only** feed preview. Until a separate authenticated develop import is actually executed and its row counts checked twice, do not claim the real showtimes are persisted.

## Public API

- GET /api/cinemas returns a capped list (50) of verified published auditoriums. A left join exposes `hasModel` and optional model version, so directory-only halls are returned without fake seat geometry.
- Without DATABASE_URL or with a database outage, the endpoint returns HTTP 503 with a stable, non-sensitive error code.
- It does not expose screenings, watch logs, user IDs or raw database credentials.
- The Vue frontend has a source-attributed 9-hall catalogue bundled for offline-friendly discovery. Exactly two Zod-validated models (TFAI Small, SPOT Taipei) support 2D/3D; the rest link to a source-only details page. Vercel's Neon read-only API returns the same published metadata with `hasModel` to allow later server-driven updates.

## Later migrations and versions

On renovation, create model version 2 (or later) rather than overwriting version 1. Exactly one current version per auditorium is enforced by a partial unique index; old version rows remain available for viewing history.
Actual showtime adapters, authentication, cross-user data protection and watch-log CRUD belong to P1.3 and P2, not this migration.
Never migrate or seed Neon main as part of a routine develop/staging branch merge; promotion requires separate, reviewed approval.
