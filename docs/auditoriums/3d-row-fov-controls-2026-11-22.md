# TheatGood — shared 3D seat-row and camera-lens controls

Checkpoint: 2026-11-22 (Taiwan). Local Git feature branch and private Tailscale owner preview.

**Later scope change:** The chain-only `/3d` catalogue now lists **393** source-backed entries, excluding the two independent models from its filters while retaining their existing standalone views. See `chain-only-3d-scope-2026-11-22.md`.

## Implemented in the shared Three.js viewer

Ordinary VieShow, Showtime and Miranew 3D routes now share one compact, collapsible camera/seat adjustment panel. There is no second renderer and the sourced seat coordinates have not changed.

- Front / back row: move to the next row with observed seats, preserving the nearest physical X coordinate. Missing row letters and aisle gaps are skipped without inventing seats; controls disable at the first/last row. The selected source seat label and URL query update together.
- Horizontal camera FOV: 45 to 95 degrees in five-degree steps, default 65 degrees. This adjusts only the CAMERA projection, not actual screen width. The existing renderer retains the chosen horizontal angle across portrait or landscape aspect ratios.
- Default/reset: restore 65 degrees. The panel is folded by default so the cinema screen remains the visual priority.
- Accessibility and appearance: touch targets, Traditional Chinese / English labels, neutral glass surfaces rather than neon, reduced-transparency fallback and a short-phone height limit.
- Miranew 2D map: switching the selected seat no longer unexpectedly resets zoom; changing the source seat pattern resets it.
- MUVIE A13 Hall 1: the special film/audio pilot is activated ONLY for the approved A13 Hall 1, rather than mistakenly replacing the general 3D controls across all VieShow halls. The pilot retains its existing movie/audio UX.

All sourced row and seat identifiers remain unchanged. Screen width/height, row pitch, rake, sightline distances and physical room architecture remain estimates, not measured facts.

## Verification

- Physical seat-navigation tests cover nearest-X row change, skipped row letters, invalid seats, front/back boundaries and same-row movement.
- Dedicated pilot tests verify only MUVIE A13 Hall 1 gets the audio/movie pilot.
- Complete Vue suite: 156 / 156 tests passed (37 files); TypeScript, ESLint and production build passed.
- Actual isolated Chromium using the owner-authorised Tailscale HTTPS preview: 393x852 Showtime Taitung Hall 2 and Miranew Tai-Mall IMAX, plus 1280x800 VieShow HsinYi Hall 1. In each, front/back row change, source seat URL updates and camera FOV 65 -> 85 -> 65 worked with no horizontal body overflow.
- The MUVIE A13 Hall 1 sensory pilot remains available and the general controls do not overlap it.
- JS runtime errors: zero. Isolated QA screenshots remain in ignored MSI .tmp/theatgood-3d-row-lens-qa-20261122.

This does not increase the count of 395 source-backed 3D preview entries or create a new physical auditorium. Showtime Tainan Rende Hall 3, Miramar and other theatres without complete verified seating grids remain pending reliable source data.

The private Tailscale HTTPS 10000 endpoint and existing 443/8443 endpoints are untouched. No public Funnel, public deployment, Git push, merge, logged-in member-browser access or paid booking occurred.
