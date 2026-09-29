# AGENTS.md

Bun monorepo: `package/` = `@adistack/data-explorer` (headless core + SQL, ships `src/`), `components/` = `@adistack/data-explorer-ui` (private, ships via `registry.json` as shadcn blocks, not npm), `examples/` = dev app. One-way deps: `components → package`, `examples → both`. No `src/core/` or `src/ui/` dirs. Terms in `docs/CONTEXT.md` are normative (Column, Filter Condition/Group, Search, Domain, Display, View, View Type, Density, Selection, Board Move).

## Layout

- `package/src/index.ts` is one of two exports (explicit allow-list, no `export *`): `.` (UI + SQL) and `./backend` (Postgres-only server-side; its transitive closure is React-free per `sql/no-ui-imports.test.ts`; entry file is `sql/backend.ts`). SQL helper `buildFilterWhere` re-exports from `./sql/index.ts` — no `./sql` subpath. Canonical homes: columns → `columns.ts` (`extractColumnConfigs`, `SEARCH_COLUMN_ID`); filters → `filters.ts`; display → `features/display-snapshot.ts`; serialization → `features/data-filtering/filter-utils.ts`.
- `components/src/`: `filter-input/` (FilterBar), `display-dropdown/`, `batch-menu/`, `views/` (`table.tsx` → `VirtualTable`, `board.tsx` → `BoardView`, `gantt.tsx` → `TimelineView`), `primitives/`, `lib/` (`utils.ts` `cn`, `dates.ts` `parseDateValue`).
- `registry.json` is the ship contract (9 items: `data-explorer-core`, `-sql`, `-filter-bar`, `-display`, `-selection`, `-table-view`, `-board-view`, `-timeline-view`, `data-explorer` aggregator). Keep `files[].path` in sync when moving sources. `lib/dates.ts` ships in the `filter-bar` and `timeline-view` items (their sources import `@/lib/dates`); `lib/utils.ts` is deliberately not shipped — vendored blocks rely on shadcn's `utils` dependency.
- `examples/` dev app: run `bun run dev` (=`bun --hot server.ts`) from `examples/` (port 4000). Canonical `Provider` wiring: `examples/src/components/explorer-shell.tsx`. Demos in `examples/src/examples/` (+ `index.ts` registry).

## Commands

From `package/` (same in `components/`): `bun run check:lint` (= `biome check --fix .`), `bun run check:types` (= `tsc --noEmit`).
Root: `bun run check:lint` is `biome check .` without `--fix` (fix is `bun run fix:lint` / `fix:format`); `bun run check:types` is workspace-wide `tsc -b`; `bun run update-deps` (hyphen) bumps + reinstalls.
Tests: `bunx vitest run` from `package/` (all; 6 co-located files: 5× `data-filtering` + `sql/filter-sql.test.ts`), single file e.g. `bunx vitest run src/features/data-filtering/filter-merge.test.ts`. No `test:unit` script, no vitest config.
CI (`checks.yml`) runs only on PRs to `beta`/`latest`: lint + types + changeset check — **no vitest in CI**, run tests locally. Publishable changes (anything outside `.changeset/`, `docs/`, `examples/`, `www/`, `.github/`, root `*.md`) require a changeset (`bunx changeset`) or CI fails.

Verify in order: lint → types → test.

## Toolchain quirks

- Bun for install/scripts. TS 7 strict: `verbatimModuleSyntax` (use `import type`), relative imports keep `.ts`/`.tsx` extensions, `noUncheckedIndexedAccess` + `noUnusedLocals/Parameters` on.
- Root `biome.json` (`files.includes: ["**"]`, git-aware, organize-imports preset `all`). Conventional commits via husky + commitlint (`build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test|wip`); pre-commit runs `bun fix:format`.
- Path aliases: `#/*` → `./src/*` per workspace; `components/` adds `@/*` → `src/*` (incl. `@/lib/dates`, `@/components/ui/*` → `src/primitives/*`); `examples/` resolves all `#/*` locally — demo-app chrome (`components/ui/card`, `lib/utils`) is local, library UI blocks come via `@adistack/data-explorer-ui` (`components/src/index.ts` barrel). Most code uses relative imports.
- TanStack table is v9 stable (`^9.2.4`, peer `>=9.0.0-beta.1`) — use v9 APIs, not v8.

## Architecture (agent gotchas)

- `Provider` (`package/src/provider.tsx`) owns the only TanStack instance and requires a `QueryClientProvider` ancestor. `defaultDisplay` is applied once as uncontrolled `initialState` — later prop changes are ignored; key `<Provider>` to reset. `manualSorting`/`manualGrouping: true`: server returns pre-sorted rows, state only drives header UI. Invalid columns are skipped + reported via `onInvalidColumn` (`strictColumns` throws); the library never logs.
- Data: `query()` prop must return `{ queryKey, queryFn }` or it throws `INVALID_QUERY_OPTIONS`; runtime wraps it in an infinite query (`limit = pageSize`, default 20, `orderBy` from `sorting[0]`). Only data-affecting state (`dataFilters`, `sorting`, `grouping`) enters the data cache key — display-only state never invalidates pages. Never mutate `table.options`; data flows `allItems → tableData` state → `useTable({ data })`.
- Filtering: custom `dataFilteringFeature` replaces built-in column filtering (`table.state.dataFilters` + `add/remove/update/clear/set/resetDataFilters`). `useInlineFilterFlow` (`idle → column → operator → value`) builds a `FilterCondition` for `table.addDataFilter`; `SEARCH_COLUMN_ID` (`"_search"`) pins `contains` and skips to value; nullary ops (`isEmpty`/`isNotEmpty`) auto-commit with `null`.
- Views: `useView` needs `ViewAdapter` (`listViews`/`updateView` required, rest optional). `saveView()` takes no args (active view only); `createView(name)` snapshots the table; with no active view `applyView(null)`/`resetToSaved()` falls back to `defaultDisplay` + empty filters (same for unknown ids). Display round-trips via `toDisplaySnapshot`/`applyDisplaySnapshot` (single `startTransition`); `ViewType` is `"table" | "board" | "timeline"` only; `TimelineView` needs `startOf`/`endOf: "timeline"` column meta. Share links: `serializeFilters` (versioned, revives `Date`s) / `serializeDisplay` (raw JSON widths; legacy `b64:` still decodes).
- SQL + errors: empty filters → `{ sql: "", params: [] }`; `isEmpty` matches `NULL`/`''`, empty `IN ()` → `(1=0)`. Match failures on `DataExplorerError.code` (`UNKNOWN_COLUMN`, `MISSING_MAPPING`, …), never on messages.
