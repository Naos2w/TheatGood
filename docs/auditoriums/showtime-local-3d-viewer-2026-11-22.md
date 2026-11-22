# TheatGood — Showtime source-verified local 2D / estimated 3D

Checkpoint: 22 November 2026 (Taiwan). Of 159 sampled Showtime hall labels across 15 venues, 158 have source-verified operator seat grids. Tainan Rende Hall 3 remains unverified. These labels are a source sample, not a complete physical auditorium census.

## Implemented

The existing shared Three.js cinema renderer now supports all 158 verified Showtime research halls, while the original VieShow route is preserved. The page includes an auditorium selector, source-preserved seat IDs and aisle gaps, scrollable and zoomable 2D seat map, shareable seat query, next/previous seat, first-person POV, whole-room overview, reset, keyboard input and WebGL fallback. The user sees explicit notices that screen width, row pitch, floor rake and physical measurements are estimates. No wheelchair position or exact screen dimension is invented.

Files: scripts/showtime-local-catalogue.mjs, scripts/vite-private-showtime-preview.mjs, src/features/viewer/showtime-local-research.ts, src/features/viewer/ShowtimeResearch3DPage.vue, src/features/viewer/CinemaHall3DPage.vue and src/features/cinemas/ShowtimeResearchHallGallery.vue.

## Privacy and publication

Showtime authenticated operator source downloads, relative seat coordinates, historical source backups and review metadata remain ONLY in the private MSI research directory, not Git or the dist bundle. The data service is enabled exclusively by Vite development mode. Network peers must use loopback TCP, a localhost/127.0.0.1/[::1] Host and matching Origin; other network clients are rejected before reading source files. Every source-verified hall is validated against the 15-venue census, per-screening-card provenance, seat-grid uniqueness and historical review before it can appear in the local viewer. The production site and Vite preview offer only a truthful unavailability notice, never fabricated layouts.

Run on MSI from the project root:

    npm run dev -- --host 127.0.0.1 --port 4185 --strictPort

Local example: http://127.0.0.1:4185/cinemas/showtime-taitung

The development viewer needs no Showtime login or browser automation. It reads existing independently verified local research. Once Rende Hall 3 has a verified preview after MSI is unlocked, it will become eligible on the next local cache refresh.

## Verified QA

- All 158 source-confirmed halls, 18,873 exact seat labels, across all 15 venues were converted into the existing 3D scene adapter without seat collisions, fabricated seats or invalid geometry.
- Isolated Chromium tested Taitung Hall 2 (89 seats) 2D selection, POV, overview, reset and return to map; Xinxin Hall 1 (382 reviewed seats); the unverified Rende Hall 3 exclusion; Dream Mall Hall 12 at 393x852 mobile; and the original VieShow Hsinyi Hall 12 route.
- JS runtime errors were zero; a confirmed optional favicon HTTP 404 is excluded from QA.
- Screenshots are only under ignored .tmp/showtime-3d-qa-20261122 on MSI.
- Local HTTP QA: 158/158 hall index, source-valid individual hall, malicious Origin 403 and unknown hall 404.
- Historical Xinxin Hall 1 source review requires two matching independent 382-seat previews, historical archive SHA and public recorded capacity; any third geometry signature reopens the conflict.

This checkpoint is local research UI, not an approved public deployment, survey-grade geometry or completed Miranew/Miramar 3D programme. No Git push, PR, merge or deployment was requested.
