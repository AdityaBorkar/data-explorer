# AGENTS.md

## What this is

A React UI library (`@adityab/data-explorer`) — a **headless** data-explorer core plus **prebuilt** UI components and a filter→SQL helper. **Not a runnable app.** Published as a library; consumers provide peer deps. The headless core (`.`) uses `@tanstack/react-table` v9 beta as its table layer. The prebuilt `./ui` vendors its own shadcn/Radix primitives in `src/ui/primitives/` and never reaches into consumer `@/` paths.

## Workspace structure

The library lives in `package/` — all source, its own `tsconfig.json`, and library-scoped scripts are there. The root `package.json` holds workspace-level tooling (biome, commitlint, husky, taze) and has its own `check:lint` / `check:types` scripts that delegate differently (root `check:types` runs `tsc -b` for the composite project graph; package-level runs `tsc --noEmit`). `www/` and `examples/` are Bun workspace members (dev/test apps). Biome excludes both via `files.includes`.

**All library commands must run from `package/`**, not the repo root.

## Toolchain

- **Bun** for install/scripts only. TypeScript 7 RC, strict, `noEmit`.
- **Biome v2** (config at repo root `biome.jsonc`). `useSortedClasses` is an **error** with `fix: "safe"` — it auto-sorts Tailwind classes in `clsx`/`cva`/`tw`/`tw.*` and the `classList` attribute. Don't hand-order Tailwind; let `bun run check:lint` do it. Double quotes (incl. JSX), 2-space indent, width 80, LF. Imports are auto-grouped (`bun:`/`node:` → packages → alias → relative) — don't fight the formatter.
- In test files (`*.test.*`), biome disables `noNonNullAssertion` and `noUnnecessaryConditions`.
- **Conventional commits** enforced via husky pre-commit (biome) and commit-msg (commitlint). Allowed types: `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`, `revert`, `style`, `test`, `wip`.

## Commands

Run from `package/`:

- `bun run check:lint` → `biome check --fix .` (auto-fixes in place)
- `bun run check:types` → `tsc --noEmit`
- `bun run test:unit` → `vitest run`
- `bun run update:deps` → `taze -rw && bun install`
- No `dev` script.

## Tests

- Co-located: `src/core/features/data-filtering/*.test.ts` (three files: `filter-merge`, `filter-utils`, `filter-grouping`).
- No vitest config — uses defaults.
- Watch: `bunx vitest`. One-shot: `bun run test:unit`.
- Single file: `bunx vitest run src/core/features/data-filtering/filter-merge.test.ts`.

## Entrypoints & structure

Three subpath exports:

- `.` → `src/core/index.ts` — headless core: `Provider`, context, hooks, filter logic, types.
- `./sql` → `src/sql/index.ts` — `buildFilterWhere` and SQL types. Depends on `.` only.
- `./ui` → `src/ui/index.ts` — prebuilt components: `batch-menu/`, `display-dropdown/`, `filter-input/`, `primitives/`, `selection-checkbox.tsx`, `views/`. Depends on `.` + `primitives/`. Dependency direction is one-way: `ui → core`, `sql → core`, never reverse.

## Architecture: TanStack table & context

**One context** — `DataExplorerContext` (`src/core/context.tsx`), consumed via `useDataExplorerContext()`. The context value includes `table` (the TanStack instance), `columnsConfig`, `data`, `onMove`, and `view`. There is no separate `TableContext`.

**Table construction** — `Provider` (`src/core/provider.tsx`) is the single place a TanStack Table instance is created via `useTable`. The feature set is `TableFeatures` from `src/core/features/index.ts`; `ColumnDef`s are typed against it. The instance is exposed as `contextValue.table`.

### Custom features

**`dataFilteringFeature`** (`src/core/features/data-filtering/`) — TanStack `TableFeature` owning `FilterCondition[]` state (`table.state.dataFilters`). Provides table-level CRUD: `table.addDataFilter()`, `removeDataFilter()`, `updateDataFilter()`, `clearDataFilters()`, `setDataFilters()`, `resetDataFilters()`. All filter logic (operators, validation, serialization, merging, grouping, inline filter flow hook) lives here. Replaces TanStack's built-in `columnFilteringFeature`.

**`displayMetaFeature`** (`src/core/features/display-meta/`) — TanStack `TableFeature` owning `density` and `viewType` state. Provides `table.setDensity()`, `setViewType()`, `resetDensity()`, `resetViewType()`.

### State ownership

- **Data filters** — table-internal via `dataFilteringFeature`. Initialized from `initialState.dataFilters: []`; `onDataFiltersChange` (via `makeStateUpdater`) keeps `table.state.dataFilters` in sync. UI calls `table.addDataFilter()` etc.
- **Row selection** — table-internal via `rowSelectionFeature`. `useSelectionContext()` reads `table.state.rowSelection` and derives a `Set<string>` + mutation helpers (`toggleRowSelection`, `clearSelection`, `selectAll`).
- **Column visibility / sorting / column sizing / grouping / density / viewType** — table-internal, initialized from `defaultDisplay` via `initialState`. Sorting and grouping are `manual` (`manualSorting`/`manualGrouping: true`) — server supplies pre-sorted flat rows; features only drive state + header UI.
- **Display snapshots** — `toDisplaySnapshot()` / `applyDisplaySnapshot()` (`src/core/features/display-snapshot.ts`) serialize/deserialize the full table display state to/from `FilterViewDisplay`. Used by the `useView` hook for view save/load, not automatic mirroring.

### Inline filter flow

`useInlineFilterFlow` (`src/core/features/data-filtering/use-inline-filter-flow.ts`) — a state machine (idle → column → operator → value) that builds a `FilterCondition` and calls `onAdd`. Consumers bind `onAdd` to `table.addDataFilter`. Special: `SEARCH_COLUMN_ID` (`"_search"`) auto-selects `contains` operator and skips to value phase.

### View management

`useView` (`src/core/hooks/use-view.ts`) — provides `activeViewId`, `applyView(id)`, `saveView()`, `resetToSaved()`. Uses a `ViewAdapter` for persistence.

## TypeScript gotchas

- `verbatimModuleSyntax: true` — type-only imports must use `import type` / `import { type X }`.
- `noUncheckedIndexedAccess: true` — indexing returns `T | undefined`.
- `@/*` → `./src/*` alias — **used by `ui/` files** to import from `@/core/` and `@/ui/primitives/` (not relative paths).
- `noUnusedLocals` / `noUnusedParameters` are **on** (root tsconfig).

## Dependencies

- **Required peer deps** (consumers provide): `react`, `react-dom`, `@tanstack/react-query`, `@tanstack/react-table` (**v9 beta**, `>=9.0.0-beta.1`).
- **Optional peer deps**: `@tanstack/react-virtual`, `react-day-picker` (via `peerDependenciesMeta`).
- **Regular deps**: `nanoid`, `zod` v4 (core); `@hello-pangea/dnd` (board view); `class-variance-authority`, `clsx`, `tailwind-merge`, `radix-ui` (unified v1 package), `cmdk`, `@tabler/icons-react` (ui/primitives).
- `@tanstack/react-table` and `react-day-picker` are also in devDeps (type-checking during development).

## Verification order

1. `bun run check:lint` (biome, auto-fixes)
2. `bun run check:types` (tsc)
3. `bun run test:unit` (vitest)
