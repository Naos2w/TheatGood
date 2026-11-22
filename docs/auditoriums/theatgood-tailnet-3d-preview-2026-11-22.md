# TheatGood — Tailscale private 3D review and Miranew patterns

Checkpoint: 2026-11-22 (Taiwan). This preview is requested by the project owner while travelling. It is not a public website.

## Completed source-compatible previews

- Showtime: 158 source-verified hall grids across 15 branches; Tainan Rende Hall 3 remains unverified until the owner unlocks MSI and the full source seat grid can be obtained. The 2D and estimated Three.js 3D interface loads these private grids only on authenticated tailnet or MSI loopback.
- VieShow/MUVIE: all existing 3D viewer routes and their sourced seats remain unchanged.
- Miranew: 13 DISTINCT operator-public observed seat-layout patterns (8 Tai-Mall, 5 Dazhi Royal), totalling 1,531 labelled seats across patterns. Public source row/column positions are supported, but permanent PHYSICAL HALL NUMBERS ARE UNVERIFIED. These previews have separate /cinemas/:slug/seat-patterns/:patternId routes and explicitly avoid claiming real permanent hall identity.
- Miramar and other chains: published hall capacities without sourced physical seat layouts are not fabricated into finished halls.

All screen width, aspect, room, seat pitch, row rise, acoustic and absolute-position values are ESTIMATES. W-labelled public source markers are preserved, but wheelchair coordinate verification is not claimed.

## Tailscale Serve (not Funnel)

Private HTTPS host: https://msi-win.tailcca2df.ts.net:10000/

Example routes:

- https://msi-win.tailcca2df.ts.net:10000/cinemas/showtime-taitung
- https://msi-win.tailcca2df.ts.net:10000/cinemas/miranew-taimall
- https://msi-win.tailcca2df.ts.net:10000/cinemas/miranew-dazhi-royal

The phone must be connected to the SAME tailnet, signed in as the same owner identity. Tailscale Serve on HTTPS 10000 proxies only to the existing local Node backend bound to 127.0.0.1:4187. Existing Serve routes on 443 and 8443 were preserved. There is no Funnel, public port mapping, Internet firewall change, Windows service or scheduler task.

The local server verifies Tailscale's proxy-injected owner login (Tailscale removes spoofed incoming identity headers), exact HTTPS tailnet host and Origin, and the loopback TCP peer. Cross-site, other users and untrusted addresses are denied. Its static root is the production dist folder. Private Showtime seats are provided only by explicit API URLs and re-validated against local source evidence. No member cookies, credentials, user history or booking data are read or exported.

Backend code: scripts/theatgood-tailnet-preview.mjs. The expected Tailscale identity is injected at process startup from the installed Tailscale status, not committed. Port 10000 runs only while MSI and the backend are available. To turn off ONLY this new Serve endpoint without affecting other existing routes, use Tailscale serve --https=10000 off. The local Node backend process can also be stopped separately.

## Verification

- Public-only Miranew 3D mapping: 13/13 observed patterns and 1,531 source labels; no fabricated permanent hall numbers.
- Source-verified Showtime 3D: 158 previously tested source-verified preview halls, with unverified Rende Hall 3 excluded.
- Actual tailnet HTTPS Chromium QA: mobile 393x852 and desktop 1280x800. Miranew Tai-Mall IMAX 329-seat pattern with 4 W markers, selecting seats, Three.js POV/overview/reset, return to 2D; Dazhi Royal 36-seat source pattern; Taitung Hall 2 private 89-seat 3D; original VieShow Hsinyi 12 route. Six verified flow groups, zero JS errors and no body overflow on the phone.
- Other signed-in Showtime Chrome windows/tabs were not touched; all browser QA ran in a separate disposable headless Chrome.
- Source data and screenshots remain private on MSI. Production dist has no authenticated Showtime source downloads, seat-grid files or archive fingerprints.

This is a tailnet-only research preview, not a public deployment or confirmation of measured real-world architectural room geometry.
