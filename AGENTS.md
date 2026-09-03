# AGENTS.md

A React library (`@adityab/data-explorer`): headless core (`.`) + prebuilt UI (`./ui`) + filter→SQL helper (`./sql`). Not a runnable app; consumers provide peer deps. Core table layer is `@tanstack/react-table` v9 beta.

## Layout

- Library lives in `package/` (`src/core/`, `src/ui/`, `src/sql/`). All library commands run from `package/`, not root.
- Root workspaces: `package`, `examples` only (`www/` is an empty stub). Root `package.json` holds biome/commitlint/husky/taze tooling.
- Exports: `.` → `src/core/index.ts`, `./sql` → `src/sql/index.ts` (`buildFilterWhere`), `./ui` → `src/ui/index.ts`. One-way deps: `ui → core`, `sql → core`, never reverse. (`module`/`types` still point at non-existent `src/index.ts` — stale; trust the `exports` map.)
- `./ui` exports 17 symbols only: `BatchMenuBar`, `SelectedCount`, display-dropdown (`DisplayColumnSelector`, `DisplayComponent`, `SortingSelector`, `SpacingDensitySelector`), filter-input (`ColumnSelector`, `FilterChip`, `FilterChipGroup`, `FilterCombinatorToggle`, `FilterBar`, `OperatorSelector`, `ValueInput`), `SelectAllCheckbox`/`SelectionCheckbox`, `BoardView` (`views/board.tsx`), `VirtualTable` (`views/table.tsx`). `views/{calendar,canvas-heirarchy,gantt,grid,list,map}.tsx` exist but are NOT re-exported; `primitives/` is vendored but NOT re-exported via `./ui`.
- `examples/` is the dev/test app (`bun --hot server.ts` from `examples/`); see `examples/src/components/explorer-shell.tsx` for canonical `Provider` wiring. 8 demos in `examples/src/examples/index.ts`: `simple-table`, `filter-bar`, `display-options`, `selection-batch`, `board-view`, `infinite-scroll`, `saved-views`, `sql-preview`.

## Commands

From `package/`:

- `bun run check:lint` → `biome check --fix .` (auto-fixes; don't hand-order Tailwind or imports, let it fix)
- `bun run check:types` → `tsc --noEmit` (root equivalent is `tsc -b`, different scope)
- Tests: no `test:unit` script and no vitest config — run `bunx vitest run` (all) or `bunx vitest run src/core/features/data-filtering/filter-merge.test.ts` (single). Co-located in `src/core/features/data-filtering/*.test.ts` (3 files).
- Root only: `bun run update:deps` → `bun taze -rw --maturity-period 3 && bun install`.

Verify in order: lint → types → test.

## Toolchain quirks

- Bun for install/scripts. TypeScript 7, strict, `noEmit`.
- Biome v2 config at root `biome.json` (`files.includes: ["**"]`, no-scope excludes apply). Conventional commits via husky + commitlint (`build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test|wip`).
- `verbatimModuleSyntax: true` — type imports need `import type`; relative imports keep `.ts`/`.tsx` extensions. `noUncheckedIndexedAccess: true`. `noUnusedLocals`/`noUnusedParameters` on.
- `@/*` → `./src/*` alias exists (`package/tsconfig.json`) but is used in only a couple `ui/` files; most code uses relative imports. `package.json` `imports` `#/*` is unused.

## Architecture

- One context: `DataExplorerContext` (`src/core/context.tsx`), via `useDataExplorerContext()`. Value is `{ table, columnsConfig, data, onMove, view }` — no separate table context.
- `Provider` (`src/core/provider.tsx`) is the only place a TanStack instance is created (`useTable` with `TableFeatures` from `src/core/features/index.ts`). It requires a `QueryClientProvider` ancestor — it calls `useInfiniteQuery` (paged data, `PAGE_SIZE = 20`, `setData` during render) and `useView` calls `useQuery` for views.
- Custom features own their state: `dataFilteringFeature` (`table.state.dataFilters: FilterCondition[]`, CRUD via `table.addDataFilter/removeDataFilter/updateDataFilter/clearDataFilters/setDataFilters/resetDataFilters`; replaces built-in column filtering) and `displayMetaFeature` (`density`, `viewType` + setters/resetters).
- `manualSorting`/`manualGrouping: true` — server returns pre-sorted flat rows; state only drives header UI. Sorting/grouping/visibility/sizing initialize from `defaultDisplay` via `initialState`.
- Row selection is table-internal (`rowSelectionFeature`); `useSelectionContext()` derives `Set<string>` + helpers from `table.state.rowSelection`.
- `useInlineFilterFlow` (`idle → column → operator → value`) builds a `FilterCondition` and calls `onAdd` (bind to `table.addDataFilter`). `SEARCH_COLUMN_ID` (`"_search"`) pins `contains` and skips to value; `isEmpty`/`isNotEmpty` auto-commit with `null`.
- Views: `useView` persists via `ViewAdapter` (`listViews`/`updateView`). `saveView()` takes no args (saves active view only); `applyView(null)` / `resetToSaved()` with no active view resets to `defaultDisplay` + empty filters. Display round-trips via `toDisplaySnapshot`/`applyDisplaySnapshot` (`src/core/features/display-snapshot.ts`), merged with `mergeDisplay`. `ViewType` is `"table" | "board" | "timeline"` only (no `grid`/`list`/`calendar` despite `ui/views/` files); `mergeDisplay` ignores `overrides.type` — always returns `base.type` (`filter-merge.ts:73`).
- `./ui` vendors its own shadcn/Radix primitives in `src/ui/primitives/` (`cn` is re-exported from the `cn` package via `primitives/utils.ts`); never import from consumer `@/` paths. `cmdk` still backs `primitives/command.tsx` + the column/operator selectors (not removed).
