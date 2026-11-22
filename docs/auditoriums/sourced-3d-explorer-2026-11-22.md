# TheatGood — complete sourced-seat 3D explorer (MSI private preview)

Checkpoint: 2026-11-22 (Taiwan time).

**Updated scope (later 2026-11-22):** The 3D explorer now includes **chain cinemas only** (222 Vie Show/MUVIE + 158 Showtime + 13 Miranew = **393** entries). The historical 395-entry snapshot below included two independent models, which are no longer listed in `/3d`; their original routes remain intact. See `chain-only-3d-scope-2026-11-22.md` for the active acceptance criteria.

## Scope and what complete means

The source-backed 3D entry page at /3d groups only already collected, verified seat grids, never capacity-only references. It is accessible from the normal homepage and supports cinema-chain filtering, venue selection, seat-layout search, and direct 2D / first-person 3D links.

| Source family                   | 3D entry count | Reliability                                                                | Notes                                                                                                                                                                            |
| ------------------------------- | -------------: | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vie Show / MUVIE                |            222 | Public booking-preview seat diagrams mapped to venue + observed hall label | 22 branches; some operator grids differ from historically published capacity counts. The viewer discloses those disagreements.                                                   |
| Showtime                        |            158 | Individually verified same-screening-card hall layouts                     | 15 branches; seat coordinates remain MSI-private, readable only via authenticated Tailscale owner or loopback. Tainan Rende Hall 3 is still absent pending the full source grid. |
| Miranew                         |             13 | Public booking-preview seating patterns, not permanent-numbered halls      | 8 at Tai-Mall, 5 at Dazhi Royal; source seats and gaps are preserved, but physical hall identity is unconfirmed.                                                                 |
| Curated independent hall models |              2 | Public source-backed seat plans                                            | TFAI small cinema and SPOT Taipei; existing individual 3D model routes are now linked from the unified explorer.                                                                 |

Total: **395 sourced 3D entry points**, not 395 unique permanent physical auditoriums. The VieShow festival Hall 12 duplicate source is NOT counted twice in the independent category; demo/fictitious models are excluded.

There are no eligible previously acquired complete seat grids for Miramar, in89, Ambassador, or other operator capacity-only records. A seat count is insufficient to reconstruct seat identifiers, aisles or row positions. The explorer does not invent missing geometry, physical screen dimensions, wheelchair coordinates or hall identity.

## UI

- Route /3d, with a compact Explore 3D link from the homepage.
- Each entry displays source seat count, a source warning and direct buttons for 2D selection and 3D first-person view.
- VieShow source layouts are dynamically loaded and validated per venue, not bundled into the initial page.
- Showtime inventory uses one authenticated read-only GET against private tailnet/loopback. On unapproved public builds, the private count is unavailable and the UI explains why.
- Miranew previews use a distinct non-permanent-hall source-pattern route and label.
- Existing shared 3D geometry, subdued palette, Traditional Chinese / English language switching and mobile RWD remain intact.

## Verification

- Unit tests validate 222 unique VieShow source-layout routes, all 13 Miranew pattern routes (1,531 source seat IDs), two nonduplicated independent models, and privacy-gated Showtime entries. No capacity-only Miramar hall is invented.
- Actual tailnet HTTPS isolated Chromium QA at 393x852 and 1280x800 passed seven groups of checks and zero runtime errors: homepage entry, 222/158/13/2 counts, Tai-Mall 329-seat 3D route, VieShow Hsinyi 14 source layouts, private Taitung 8-hall 3D, TFAI small 3D, exclusion of unsupported Miramar, mobile no document horizontal overflow and desktop layout.
- The existing Tailscale Serve port 10000 and its authenticated owner-only local backend were reused, without adding tabs, new windows or a public Funnel. The separately signed-in Showtime Chrome was not touched.
- Room geometry remains estimated even when the source seat grids are verified.
- Private Showtime source JSON, booking downloads, credentials and original seat coordinates are never committed to Git or the publicly built dist.

Owner-only Tailscale preview: https://msi-win.tailcca2df.ts.net:10000/3d

No public deploy, merge, production data mutation or Serve configuration change was made.
