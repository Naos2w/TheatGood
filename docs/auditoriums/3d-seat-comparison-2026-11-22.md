# TheatGood — source-seat A/B comparison across all 3D viewers

Checkpoint: 22 November 2026 (Taiwan time).

## Functionality

All source-backed 3D preview routes now share the same collapsible Seat/camera settings panel, which includes A/B comparison. The user can save the currently selected source seat, use existing left/right and front/back controls or the 2D seat map to choose a different seat, then switch back and forth between the two without recreating the 3D renderer. The selected real source label updates the URL query. Moving to a new hall or observed seat pattern clears the old comparison.

The saved comparison is ephemeral Vue state only. No seat is booked, selected on an operator website, persisted to a database, copied to localStorage, or recorded in viewing history. The user compares estimated 3D viewpoints, not scientifically measured sightlines. Sourced seat labels, row/column gaps and source integrity are unchanged.

The common controls also support front/back row and adjustable horizontal camera FOV (45–95 degrees, default 65). Independent curated models for TFAI small auditorium and SPOT Taipei now use the same controls, a whole-room overview switch and URL seat synchronisation, instead of their old fixed FOV and left/right-only navigation. The approved MUVIE Taipei A13 Hall 1 special audiovisual pilot remains separate, retaining its film/audio controls. Its existing film-information panel now includes the same front/back row, A/B comparison and 45–95 degree FOV adjustments without replacing or moving the play, mute or cinema-seat toolbar.

## Implementation

- src/features/viewer/seat-comparison.ts and seat-comparison.test.ts: pure validation that both seat IDs exist in the current room, then swap.
- src/features/viewer/Cinema3DSeatTools.vue: shared foldable A/B comparison UI with accessible labels, buttons and clear/reset.
- src/features/viewer/VieShowEstimated3DPage.vue, ShowtimeResearch3DPage.vue and MiranewPattern3DPage.vue: ephemeral comparisons, hall reset and URL sync.
- src/features/viewer/ViewerPage.vue: independent 3D overview, row/FOV controls, A/B comparison and selected-seat URL.
- Existing private research middleware and operator authentication restrictions are not modified.

## Verification

- Full Vue/Vitest suite: 159/159 passing tests (38 files). TypeScript, ESLint, Prettier and production build passed.
- Actual owner-only Tailscale HTTPS with isolated Chromium: Showtime Taitung Hall 2 (393x852), Miranew Tai-Mall IMAX (320x700), VieShow HsinYi Hall 1 (1280x800), TFAI small auditorium (393x852), SPOT Taipei (320x700). Comparisons swapped twice, seat URLs synchronised, saved seat cleared, shared renderer reused, no document horizontal overflow, JS runtime errors zero.
- The MUVIE A13 Hall 1 dedicated film/audio pilot was separately tested at 393x852: A/B comparison of D04 and C04, two swaps with URL updates, FOV change to 85, no page overflow or JavaScript errors, with its film playback and mute controls preserved.
- Chromium device-size emulation is not a completed physical iPhone Safari or Android device sign-off.
- E2E screenshots remain in ignored MSI local .tmp/theatgood-seat-comparison-qa-20261122 and .tmp/theatgood-independent-3d-qa-20261122.

## Limitations and deployment

The catalogue remains 395 SOURCE-BACKED preview entries, not 395 independently surveyed physical auditoriums. Showtime Tainan Rende Hall 3 still lacks the required complete operator seat grid; other cinemas with only published capacities cannot be considered finished. Absolute screen size, room width, seat pitch and rake remain estimated unless a separately documented source explicitly supports them.

The owner-only private Tailscale Serve URL is https://msi-win.tailcca2df.ts.net:10000/3d with the MSI loopback-only source backend. No public Funnel, route changes, booked seats, Git push, PR, merge or production service mutations were involved. All private Showtime grids remain outside public Git and the production dist.
