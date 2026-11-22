# TheatGood — chain cinemas only in the 3D explorer

Checkpoint: 22 November 2026, Taiwan time.

## Updated scope

The /3d explorer now prioritises commercial cinema operators represented in the chain directory. Only source-backed seating previews from these brands are counted:

- Vie Show / MUVIE: 222 public, individually labelled seat layouts.
- Showtime: 158 privately source-verified halls across 15 branches. Requires the authorised MSI or Tailscale owner preview.
- Miranew: 13 operator-observed seating patterns (8 Tai-Mall, 5 Dazhi Royal). Permanent physical hall numbers are not independently established.

Total: 393 sourced 3D preview entries. This is NOT a count of 393 independently surveyed, permanent physical auditoriums. No new auditorium geometry has been created by narrowing the catalogue.

## Excluded from the chain 3D explorer

TFAI small auditorium and SPOT Taipei are not treated as chains and have been removed from the /3d filter, venue selector, summary and entry links. They were previously the two additional entries in the 395 count. Their original curated model files, existing direct /auditoriums/... routes and independent theatre directory records are retained for backward compatibility, but they are outside this phase. Old links with brand=independent and cinema=independent|... are normalised to a valid chain filter and venue; this does not erase saved models.

## Chain work still pending

- Miramar Dazhi exists in the chain directory and currently provides published hall capacities, but no complete seat labels with trustworthy row/column positions. It is shown as WAITING FOR VERIFIED SEATING SOURCES, not as a clickable 3D model.
- Showtime Tainan Rende Hall 3 still lacks the full source-verified grid; its public cinema listing remains but no guessed seat layout is created. It can be completed only after a compliant operator preview is obtained and safely audited.
- Other operator families, including in89 and Ambassador, require reliable operator seat-grid evidence and appropriate chain-directory integration before representing their halls as source-verified 3D.

A capacity, cinema photograph or screen size alone is insufficient to reconstruct actual seat labels or aisle positions. Screens and room dimensions in existing 3D previews remain explicitly ESTIMATED unless supported by a cited source.

## UX and regression safeguards

The 3D explorer has exactly three chain tabs plus the All tab, a three-column summary on larger screens, and a clearly distinguished pending-source list for chain venues without verified seat geometry. The homepage link labels this feature "chain cinema 3D". No non-chain model route is deleted.

MSI owner-only Tailscale URL: https://msi-win.tailcca2df.ts.net:10000/3d

Isolated Chromium confirmed mobile 393x852 and desktop 1280x800, exact source-summary 222/158/13, source-backed Miranew and private Showtime listings, missing Miramar grid notice, old independent filter URL migration, preservation of legacy independent direct routes, no document horizontal overflow, and zero JavaScript errors. Full regression tests, formatting and production build are checked before committing.

No Git push, public Funnel, production deployment, account/browser session access or modification to the existing Tailscale Serve 443/8443/10000 routes is part of this scope change.
