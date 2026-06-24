# AGENTS.md

## What this is

A React UI library (`@adityab/data-explorer`) — a **headless** data-explorer core plus **prebuilt** UI components and a filter→SQL helper. **Not a runnable app.** Published as a library; consumers provide peer deps. The headless core (`.`) uses `@tanstack/react-table` as its headless table layer: the `Provider` constructs the TanStack Table instance and exposes it via `TableContext`/`useTableContext` (see [Headless table](#headless-table-tanstack)). The prebuilt `./ui` vendors its own shadcn/Radix primitives in `src/ui/primitives/` and never reaches into consumer `@/` paths.

## Workspace structure

The library lives in `package/` — all source, its own `tsconfig.json`, and library-scoped scripts are there. The root `package.json` holds workspace-level tooling (biome, commitlint, husky, taze) and has its own `check:lint` / `check:types` scripts that delegate differently (root `check:types` runs `tsc -b` for the composite project graph; package-level runs `tsc --noEmit`). `www/` and `examples/` are Bun workspace members (dev/test apps). Biome excludes both via `files.includes`.

**All library commands must run from `package/`**, not the repo root.

## Toolchain

- **Bun** for install/scripts only (`bun install`, `bun run <script>`). TypeScript 7 RC, strict, `noEmit`.
- **Biome v2** (real config at repo root `biome.jsonc`, not defaults). `useSortedClasses` is an **error** with `fix: "safe"` — it auto-sorts Tailwind classes in `clsx`/`cva`/`tw`/`tw.*` and the `classList` attribute. Don't hand-order Tailwind; let `bun run check:lint` do it. Double quotes (incl. JSX), 2-space, width 80, LF. Imports are auto-grouped (`bun:`/`node:` → packages → alias → relative) — don't fight the formatter.
- In test files (`*.test.*`), biome disables `noNonNullAssertion` and `noUnnecessaryConditions`.
- **Conventional commits** enforced via husky pre-commit (biome) and commit-msg (commitlint). Allowed types: `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`, `revert`, `style`, `test`, `wip`.

## Commands

Run from `package/`:

- `bun run check:lint` → `biome check --fix .` (auto-fixes in place)
- `bun run check:types` → `tsc --noEmit`
- `bun run test:unit` → `vitest run`
- `bun run update:deps` → `taze -rw && bun install` (recursive workspaces)
- No `dev` script.

## Tests

- Co-located in `src/core/features/data-filtering/` (`*.test.ts`). Three test files: `filter-merge.test.ts`, `filter-utils.test.ts`, `filter-grouping.test.ts`.
- No vitest config file — uses defaults.
- `bunx vitest` opens **watch mode**; for one-shot use `bunx vitest run` or `bun run test:unit`.
- Single file: `bunx vitest run src/core/features/data-filtering/filter-merge.test.ts`.

## Entrypoints & structure

Three subpath exports (the real barrels):

- `.` → `src/core/index.ts` — headless: hooks, filter logic (via `dataFilteringFeature`), provider/context (incl. `TableContext`), view adapter, types. Depends on react + react-query + @tanstack/react-table (+ nanoid, zod v4).
- `./sql` → `src/sql/index.ts` — filter → SQL. Depends on `.` only.
- `./ui` → `src/ui/index.ts` — prebuilt components. Real dirs: `batch-menu/`, `display-dropdown/`, `filter-input/`, `primitives/`, `views/` (one `.tsx` file per view: `board`, `list`, `map`, `timeline`, `table`). Depends on `.` + `primitives/`. Dependency direction is one-way: `ui → core`, `sql → core`, never reverse.

## Headless table (TanStack)

The `Provider` is the single place a TanStack Table instance is constructed (`src/core/provider.tsx`). The feature set lives in `src/core/features/index.ts` (`dataExplorerTableFeatures` / `DataExplorerTableFeatures`); `ColumnDef`s are typed against it. The instance is exposed via `TableContext` / `useTableContext()` (core/context.tsx).

The custom `dataFilteringFeature` (`src/core/features/data-filtering/`) is a TanStack `TableFeature` that owns `FilterCondition[]` state (`state.dataFilters`) and provides table-level CRUD APIs (`addDataFilter`, `removeDataFilter`, `updateDataFilter`, `clearDataFilters`, `setDataFilters`, `resetDataFilters`). All filter logic — operators, validation, serialization, merging, grouping, schema, and the inline filter flow hook — lives in this directory. The feature replaces TanStack's built-in `columnFilteringFeature` (which uses a different `ColumnFiltersState` model).

Context structure: two contexts only — `DataExplorerContext` (config, display, data, view, callback) and `TableContext` (the table instance, which includes filter state via `dataFilteringFeature` and selection via `rowSelectionFeature`). Backward-compatible hooks (`useConfigContext`, `useDisplayContext`, `useDataContext`, `useViewContext`, `useCallbackContext`, `useSelectionContext`) destructure from these two.

State ownership (deliberate split):

- **Data filters** — controlled by the `Provider`'s `useState` (`dataFilters`), passed as `state.dataFilters` and mirrored back via `onDataFiltersChange`. UI calls `table.addDataFilter()` etc.; the `useInlineFilterFlow` hook uses the `onAdd` callback which the caller binds to `table.addDataFilter`.
- **Row selection** — table-internal (`rowSelectionFeature`). `useSelectionContext` reads `table.state.rowSelection` and forwards mutations (`toggleRowSelection`, `resetRowSelection`, `toggleAllRowsSelected`). No `Set`-based mirror, no `useEffect` sync. This is the source of truth.
- **Column visibility / sorting / column sizing / grouping** — *controlled* by `FilterViewDisplay` so they persist into saved views and feed the data query key. `state.{columnVisibility,sorting,columnSizing,grouping}` is derived from `display`; the `on*Change` handlers mirror updates back into `display` via `setDisplay`. Sorting and grouping are `manual` (`manualSorting`/`manualGrouping: true`) — the server supplies pre-sorted, flat rows, so the row model is never reordered client-side; the features only drive state + header UI (`getIsSorted`, `getToggleSortingHandler`, `toggleVisibility`, `getSize`).

Removed features (redundant): `columnFilteringFeature` (replaced by `dataFilteringFeature`), `columnResizingFeature` (only adds drag-resize `columnSizingInfo` state, unused), `columnOrderingFeature` (`state.columnOrder` never set, drag-reorder not used).

The `VirtualTable` view and the display/selection UI consume the instance from context — they no longer build their own table. `Provider` now takes `columns: ColumnDef[]` (with `meta: DataExplorerColumnMeta`); `columnsConfig` is derived via `extractColumnConfigs`.

## TypeScript gotchas

- `verbatimModuleSyntax: true` — type-only imports must use `import type` / `import { type X }`.
- `noUncheckedIndexedAccess: true` — indexing returns `T | undefined`.
- `@/*` → `./src/*` alias — **used by `ui/` files** to import from `@/core/` and `@/ui/primitives/` (not relative paths).
- `noUnusedLocals` / `noUnusedParameters` are **on** (set in root tsconfig, not overridden by package).

## Dependencies

- **Required peer deps** (consumers provide): `react`, `react-dom`, `@tanstack/react-query`, `@tanstack/react-table` (**v9 beta**, `>=9.0.0-beta.1`).
- **Optional peer deps**: `@tanstack/react-virtual`, `react-day-picker` (via `peerDependenciesMeta`).
- **Regular deps**: `nanoid`, `zod` v4 (core); `@hello-pangea/dnd` (board view drag-and-drop); `class-variance-authority`, `clsx`, `tailwind-merge`, `radix-ui` (unified v1 package), `cmdk`, `@tabler/icons-react` (ui/primitives). Both primitives and higher-level UI components use `@tabler/icons-react`.
- `@tanstack/react-table` and `react-day-picker` are also in devDeps (for type-checking during development).

## Verification order

1. `bun run check:lint` (biome, auto-fixes)
2. `bun run check:types` (tsc)
3. `bun run test:unit` (vitest)
