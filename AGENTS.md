# AGENTS.md

React library `@adistack/data-explorer`: headless core + SQL helper in single `.` export (re-exports `./sql/index.ts` `buildFilterWhere` — no `./sql` subpath). UI blocks live in `components/` (`@adistack/data-explorer-ui`, private) and ship via `registry.json` (shadcn). Not a runnable app; consumers provide peer deps. Table layer is `@tanstack/react-table` v9 stable (`^9.2.4`, peer `>=9.0.0-beta.1`). Terms in `docs/CONTEXT.md` are normative (Column, Filter Condition, Filter Group, Search, Domain, Display, View, View Type, Density, Selection, Board Move).

## Layout

- `package/src/`: `index.ts` (sole export `.`, explicit allow-list), `context.tsx`, `provider.tsx`, `types.ts` (re-exports `columns.ts`/`filters.ts`/`views.ts`/`query.ts`/`errors.ts`), `columns.ts` (canonical `extractColumnConfigs`, `SEARCH_COLUMN_ID`), `extract-column-config.ts` (deprecated shim), `features/` (`data-filtering/` 9 impl + `use-inline-filter-flow.ts` + 5 tests, `display-meta/` 2 files, `display-snapshot.ts`, `index.ts` = `TableFeatures`), `hooks/` (`use-data-query.ts`, `use-view.ts`, `use-load-more.ts`, `use-selection.ts`), `sql/` (`filter-sql.ts`, `index.ts`, 1 test). No `src/core/` or `src/ui/` dirs.
- `components/src/`: `index.ts` (18 symbols), `batch-menu/` (3), `display-dropdown/` (4), `filter-input/` (8 incl `use-filter-bar-keyboard.ts`), `views/` (`table.tsx` → `VirtualTable`, `board.tsx` → `BoardView`, `gantt.tsx` → `TimelineView`), `primitives/` + `lib/utils.ts` (`cn` shim) + `lib/dates.ts` (`parseDateValue`). Core imports via `@adistack/data-explorer`; intra-UI via relative + `@/`/`#/` aliases.
- `examples/` is the dev app (`bun --hot server.ts` or `bun run dev` from `examples/`); canonical `Provider` wiring is `examples/src/components/explorer-shell.tsx`. 8 demos in `examples/src/examples/`: `simple-table`, `filter-bar`, `display-options`, `selection-batch`, `board-view`, `infinite-scroll`, `saved-views`, `sql-preview` (+ `index.ts` registry = 9 files).
- `registry.json` is the ship contract: 9 items (`data-explorer-core`, `-sql`, `-filter-bar`, `-display`, `-selection`, `-table-view`, `-board-view`, `-timeline-view`, `data-explorer` aggregator). Keep `files[].path` in sync when moving sources. Known gaps: `timeline-view` description claims relative `parseDateValue` import (actual `@/lib/dates`), `lib/dates.ts` is in no item; `components/package.json` `files`/`exports` are stale (`./index.ts` vs `src/index.ts`, stray `selection-checkbox.tsx`).
- One-way deps: `components → package`, `examples → both`. `sql → types`/filter helpers, never reverse.

## Commands

From `package/` (same in `components/`):
- `bun run check:lint` → `biome check --fix .` (root is `biome check .` without `--fix`; fix lives in root `fix:lint`)
- `bun run check:types` → `tsc --noEmit` (root `tsc -b` is workspace-wide)
- `bunx vitest run` (all, from `package/`) or `bunx vitest run src/features/data-filtering/<name>.test.ts` (single; 6 co-located files: 5× `data-filtering` + `sql/filter-sql.test.ts`). No `test:unit` script, no vitest config.

Root only: `bun run update-deps` (hyphen) → `bun taze -rw --maturity-period 3 && bun install`.

Verify in order: lint → types → test.

## Toolchain quirks

- Bun for install/scripts. TS 7, strict, `emitDeclarationOnly` at root (`--noEmit` via package script), `verbatimModuleSyntax: true` (use `import type`), relative imports keep `.ts`/`.tsx` extensions, `noUncheckedIndexedAccess` + `noUnusedLocals/Parameters` on.
- Root `biome.json` (`files.includes: ["**"]`, git-aware). Conventional commits via husky + commitlint (`build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test|wip`); pre-commit runs `bun fix:format`.
- Path aliases: `#/*` → `./src/*` per workspace; `components/` adds `@/*` plus `#/components/ui/*` + `@/components/ui/*` → `src/primitives/*` and `#/lib/utils` + `@/lib/utils` → `src/lib/utils.ts` (plus `@/lib/dates`); `examples/` mirrors `#/components/ui/*` → `../components/src/primitives/*`, `#/lib/utils` → `../components/src/lib/utils.ts`. Most code uses relative imports.

## Architecture

- One context: `DataExplorerContext` (`package/src/context.tsx`) via `useDataExplorerContext()` → `{ table, columnsConfig, data, onMove, view }`. Selection via `useSelectionContext()` → full `SelectionState` (`selectedRowIds: Set<string>`, `selectedCount`, `toggle`/`clear`/`selectLoadedRows`, …), not just a `Set`.
- `Provider` (`package/src/provider.tsx`) is the only TanStack instance (`useTable` + `TableFeatures`). Requires a `QueryClientProvider` ancestor. Data via `useDataQuery` (`useInfiniteQuery`, `DEFAULT_PAGE_SIZE = 20` with deprecated `PAGE_SIZE` alias, pages merged to `allItems` → `tableData` state → `useTable({ data })`, never `table.options` mutation; `useView` needs `useQuery`). `query` prop builds `UseQueryOptions` (runtime wraps in infinite query: validates `queryKey`+`queryFn`, `limit = pageSize`, `orderBy` from `sorting[0]`). Extra props: `pageSize`, `staleTime`, `debounceFiltersMs`, `strictColumns`/`onInvalidColumn`.
- `manualSorting`/`manualGrouping: true` — server returns pre-sorted flat rows; state only drives header UI. Sorting/grouping/visibility/sizing init from `defaultDisplay` via `toInitialTableState` (single-sort/single-group: first sort + `grouping[0]` round-trip). Custom state: `dataFilteringFeature` (`table.state.dataFilters`, CRUD `add/remove/update/clear/set/resetDataFilters`, replaces built-in column filtering) and `displayMetaFeature` (`density`, `viewType` + setters/resetters).
- `useInlineFilterFlow` (`idle → column → operator → value`) builds a `FilterCondition` for `onAdd` (bind to `table.addDataFilter`). `SEARCH_COLUMN_ID` (`"_search"`) pins `contains` and skips to value; nullary ops (`isEmpty`/`isNotEmpty`) auto-commit with `null`.
- Views: `useView` persists via `ViewAdapter` (`listViews`/`updateView` required, `createView`/`deleteView`/`renameView` optional). `saveView()` takes no args (saves active view only); `createView(name)` snapshots table; `applyView(null)` / `resetToSaved()` with no active view resets to `defaultDisplay` + empty filters; unknown id after load also resets. Display round-trips via `toDisplaySnapshot`/`applyDisplaySnapshot` (single `startTransition`), merged over defaults with `mergeDisplay`. Share links via `serializeFilters`/`serializeDisplay` (raw JSON widths, legacy `b64:` decodes). `ViewType` is `"table" | "board" | "timeline"` only; `TimelineView` is driven by `startOf`/`endOf: "timeline"` column meta.
