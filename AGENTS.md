# AGENTS.md

React library `@adistack/data-explorer`: headless core + SQL helper in one export. UI blocks live in `components/` (`@adistack/data-explorer-ui`, private) and ship via `registry.json` (shadcn). Not a runnable app; consumers provide peer deps. Table layer is `@tanstack/react-table` v9 beta. Terms in `docs/CONTEXT.md` are normative (Filter Condition, Display, View, View Type, Density, Selection, Board Move).

## Layout

- `package/src/`: `index.ts` (sole export `.`, re-exports `./sql/index.ts` `buildFilterWhere` — no `./sql` subpath), `context.tsx`, `provider.tsx`, `types.ts`, `extract-column-config.ts`, `features/` (`data-filtering/`, `display-meta/`, `display-snapshot.ts`, `index.ts` = `TableFeatures`), `hooks/` (`use-view.ts`, `use-load-more.ts`), `sql/`. No `src/core/` or `src/ui/` dirs.
- `components/src/`: `index.ts` (18 symbols), `batch-menu/`, `display-dropdown/`, `filter-input/`, `views/` (`table.tsx` → `VirtualTable`, `board.tsx` → `BoardView`, `gantt.tsx` → `TimelineView`), `primitives/` + `lib/utils.ts` (vendored shadcn for local dev only). Imports core via `@adistack/data-explorer`, never relative.
- `examples/` is the dev app (`bun --hot server.ts` or `bun run dev` from `examples/`); canonical `Provider` wiring is `examples/src/components/explorer-shell.tsx`. 9 demos in `examples/src/examples/`: `simple-table`, `filter-bar`, `display-options`, `selection-batch`, `board-view`, `infinite-scroll`, `saved-views`, `sql-preview` (+ `index.ts` registry).
- `registry.json` is the ship contract: 8 items (`data-explorer-core`, `-sql`, `-filter-bar`, `-display`, `-selection`, `-table-view`, `-board-view`, `-timeline-view`, `data-explorer` aggregator). Keep `files[].path` in sync when moving sources.
- One-way deps: `components → package`, `examples → both`. `sql → types`/filter helpers, never reverse.

## Commands

From `package/` (library scope):
- `bun run check:lint` → `biome check --fix .` (auto-fixes; don't hand-order imports/Tailwind)
- `bun run check:types` → `tsc --noEmit` (root `tsc -b` is a different, workspace-wide scope)
- `bunx vitest run` (all) or `bunx vitest run src/features/data-filtering/<name>.test.ts` (single; 5 co-located files). No `test:unit` script, no vitest config.

Root only: `bun run update:deps` → `taze -rw --maturity-period 3 && bun install`.

Verify in order: lint → types → test.

## Toolchain quirks

- Bun for install/scripts. TS 7, strict, `noEmit`, `verbatimModuleSyntax: true` (use `import type`), relative imports keep `.ts`/`.tsx` extensions, `noUncheckedIndexedAccess` + `noUnusedLocals/Parameters` on.
- Root `biome.json` (`files.includes: ["**"]`, git-aware). Conventional commits via husky + commitlint (`build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test|wip`).
- Path aliases: `#/*` → `./src/*` per workspace; shadcn `#/components/ui/*` → `components/src/primitives/*` and `#/lib/utils` → `components/src/lib/utils.ts` (defined in `components/tsconfig.json`, mirrored to `../components/src/*` in `examples/tsconfig.json`). Most code uses relative imports.

## Architecture

- One context: `DataExplorerContext` (`package/src/context.tsx`) via `useDataExplorerContext()` → `{ table, columnsConfig, data, onMove, view }`. Selection derives via `useSelectionContext()` (`Set<string>` from `table.state.rowSelection`).
- `Provider` (`package/src/provider.tsx`) is the only TanStack instance (`useTable` + `TableFeatures`). Requires a `QueryClientProvider` ancestor (`useInfiniteQuery`, `PAGE_SIZE = 20`, feeds pages into `table.options.data` directly; `useView` needs `useQuery`). `query` prop builds `UseQueryOptions`; `viewAdapter?` enables persisted views.
- `manualSorting`/`manualGrouping: true` — server returns pre-sorted flat rows; state only drives header UI. Sorting/grouping/visibility/sizing init from `defaultDisplay` via `toInitialTableState`. Custom state: `dataFilteringFeature` (`table.state.dataFilters`, CRUD `add/remove/update/clear/set/resetDataFilters`, replaces built-in column filtering) and `displayMetaFeature` (`density`, `viewType` + setters/resetters).
- `useInlineFilterFlow` (`idle → column → operator → value`) builds a `FilterCondition` for `onAdd` (bind to `table.addDataFilter`). `SEARCH_COLUMN_ID` (`"_search"`) pins `contains` and skips to value; nullary ops (`isEmpty`/`isNotEmpty`) auto-commit with `null`.
- Views: `useView` persists via `ViewAdapter` (`listViews`/`updateView`). `saveView()` takes no args (saves active view only); `applyView(null)` / `resetToSaved()` with no active view resets to `defaultDisplay` + empty filters; unknown id after load also resets. Display round-trips via `toDisplaySnapshot`/`applyDisplaySnapshot`, merged over defaults with `mergeDisplay`. `ViewType` is `"table" | "board" | "timeline"` only; `TimelineView` is driven by `startOf`/`endOf: "timeline"` column meta.
