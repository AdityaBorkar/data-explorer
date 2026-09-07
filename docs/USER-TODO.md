# TODO

## Now / Next

- E2E + more unit coverage (`display-meta`, `use-view`, `Provider`, `use-data-query`)
- Decide on fuzzy filtering + faceting: explicitly absent today (no fuzzy match, no facet counts) — keep out or spec them
- Fix ship gaps: `timeline-view` registry description (claims relative `parseDateValue` import, actual `@/lib/dates`), `lib/dates.ts` in no registry item; `components/package.json` `files`/`exports` stale (`./index.ts` vs `src/index.ts`, stray `selection-checkbox.tsx`)

## Phase 2

- Map View
- Table View with Tree Tables
- Transform `examples` using Fumadocs + Wrangler, with docs in-repo
- Skills and checks: `security-audit`, `vulnerabilities`, `bug-finder`, `performance-optimizations`
- `@abstack/conform` tasks (README, GitHub Actions, repo settings, auto-publishing) — confirm scope, looks unrelated to this repo

## Not supported

- Single-sort / single-group only (first sort + `grouping[0]` round-trip; multi-sort collapses)
- Infinite-scroll cursor pagination only (`nextCursor`, `loadMoreRef` sentinel) — no classic page-number UI
- No drag-resize UI for column widths (widths ride snapshots/share links only), no column ordering/pinning UI, no row pinning, no expanding
