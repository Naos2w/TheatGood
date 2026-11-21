# Showtime seat-layout research — safe source-control checkpoint

**Status (Taiwan time, 21 November 2026):** TheatGood has source-verified relative seat grids for **142 of 159** *sampled* Showtime cinema/hall labels; **17** sampled hall labels still lack a conflict-free source. The private MSI research area holds 97 normalised hall snapshots with 12,104 seat labels. These figures are **not** a complete physical auditorium census, measured geometry, or a published 3D model count.

## Source-control boundary

This GitHub repository is **public**. The authenticated Showtime seat-preview source downloads, their SHA/audit archives, and the relative seat-coordinate JSON snapshots are retained **locally on MSI**, outside version control. Specific `.gitignore` rules prevent accidental inclusion. No session, cookie, booking state, account identifier, personal information, or operator image assets should be committed.

The scripts and synthetic fixtures in this checkpoint can be reviewed and tested without access to the member session. They do **not** recreate the private geometry. Public hall names are *sampled from advertised screening cards* and are distinct from permanent hall identity or measured seating.

## Reproducible, bounded workflow

1. Public-only discovery: `node scripts/research_showtime_public_movie_counts.mjs` and `node scripts/research_showtime_public_missing_hall_screenings.mjs <cinema-slug> <movie-card-offset>`.
2. On the user's **already authenticated** dedicated Chrome, check the installed v0.1.6 extension is idle and the official page shows 「會員中心」. Do not read credentials, cookies, or session material.
3. Preview the targeted request with `pwsh -NoProfile -File scripts/research_trigger_showtime_targeted_once.ps1 -CinemaSlug <cinema-slug> -StartMovie <offset> -DryRun`. Only then issue the single bounded request without `-DryRun`. Wait for a terminal status before another venue.
4. Inspect the new **local** source file and audit. Use `node scripts/research_import_verified_showtime_extension.mjs <download.json> --quarantine-conflicts --dry-run` first. A real import requires the same command without `--dry-run`. Never overwrite a different archived grid: duplicates are preserved as evidence, and genuinely conflicting or cross-hall-reused grids are quarantined.
5. Rebuild local-only coverage/readiness manifests and run the research/security tests. Do not interpret public session-card evidence as architectural dimensions, slope, screen size, wheelchair geometry, or approval to publish a third party's seating data.

### Outstanding source verification

The 17 sampled hall-label gaps are concentrated in Chiayi (8), Dream Mall (9), Gangshan (6), Keelung (2/6), Taichung Wenxin (9/11/16), Tainan Rende (3), Taipei Xinxin (14), Taitung (3/4/7/8), and Tucheng (1/3/11). The numbers in parentheses are **hall labels**, not quantities of seats. Several had public screenings without accessible seat previews at the time of collection. Prior attempted movie-card ranges and source conflicts are documented in the **private MSI research TODO/checkpoints**, not committed to the public repository.

**Release status:** This checkpoint is local Git only: no push, PR, merge, deployment or public seat-layout export. The product viewer has not been populated with the private research dataset.
