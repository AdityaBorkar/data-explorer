# Better DX Report — `@adistack/data-explorer` (`package/`)

Scope: `package/src/**` (headless core + SQL helper). Verified with `bunx vitest run` (58 passed, 5 files) and `bun run check:types` (clean).
Goal: lower friction for consumers while keeping hot paths (`useDataQuery`, `useSelectionContext`, `buildFilterWhere`, table state) allocation-light and memo-stable.

## Priority matrix

| # | Area | Problem | Payoff if fixed |
|---|------|---------|-----------------|
| P0 | `src/index.ts:15,25,46-47` wildcard exports | `export *` leaks internals, breaks tree-shaking, no stable contract | Explicit public surface, safe refactors |
| P0 | `src/provider.tsx:21-44` inline props + silent `initialState` | Props not exported/documented; `defaultDisplay`/`columns` changes after mount ignored | Predictable controlled/uncontrolled behavior |
| P0 | `src/hooks/use-data-query.ts:100` direct `table.options.data` mutation | Mutating TanStack options outside render; concurrent-mode unsafe | Correct data flow, no torn rows |
| P0 | `src/sql/filter-sql.ts:152-179` Postgres-only SQL, no dialect | `ILIKE`, `@>`, `::text[]`, `$n` hardcoded; `isEmpty` = `IS NULL` only | Portable SQL, correct empty semantics |
| P1 | `src/types.ts:16-43` generic lie | `ContextType<TItem>` casts `ReactTable<…, Record<string,unknown>>` to `TItem` | Real type safety for rows |
| P1 | `src/hooks/use-selection.ts:18-37` single `useMemo` + fresh `Set` | `selectedRowIds` identity churns; `allRowIds` O(n) recomputed on every selection change | No cascade re-renders in large tables |
| P1 | `src/features/data-filtering/use-inline-filter-flow.ts:153-169` flat 16-key return + raw setters | Consumers can put machine in invalid state (`setPendingValue` bypasses `commitDraft`) | Narrow, guided API |
| P1 | README stub, zero TSDoc | `package/README.md:1-15` is `bun init` template; no public symbol has JSDoc | Adoption without reading source |
| P2 | QueryKey + pagination | `use-data-query.ts:80-92` passes raw objects; `PAGE_SIZE=20` hardcoded; `queryBuilder` footgun | Stable caching, configurable paging |
| P2 | Views | `use-view.ts:64-95` silent failures, `saveView()` no-args only, no `isLoading/error` | Debuggable persisted views |
| P2 | Serialization | `filter-utils.ts:17-49` drops `Date` revival; `display-snapshot.ts:95-108` JSON-in-URL for widths | Round-trip-safe share links |
| P2 | Errors | `throw new Error(string)` in 6 places; `columns.ts:43-53` `console.warn` | Actionable, catchable errors |

---

## 1. Public API surface (`src/index.ts`, `src/types.ts`)

### 1.1 Replace `export *` with an explicit allow-list
Current `src/index.ts:15,25,46-47`:
```ts
export * from "./features/data-filtering/filter-draft.ts";
export * from "./features/data-filtering/filter-semantics.ts";
export * from "./sql/index.ts";
export * from "./types.ts";
```
Any rename is a breaking change and bundlers cannot tree-shake as well.

```ts
// src/index.ts — explicit surface
export { buildDraftCondition, commitDraft, editorKind, formatFilterValue } from "./features/data-filtering/filter-draft.ts";
export type { DraftCommit, FilterEditorKind } from "./features/data-filtering/filter-draft.ts";
export { buildFilterWhere } from "./sql/filter-sql.ts";
export type { BuildFilterOptions, ColumnMapping, ParameterizedSql } from "./sql/filter-sql.ts";
// Keep ONE canonical path per domain; add deprecation shim if needed.
```

Keep `filter-merge.ts:4` re-export of `mergeDisplay` — it currently makes display logic importable from two paths. Re-export only from `display-snapshot.ts`.

### 1.2 Kill the dual context types
`src/types.ts:16-43` defines `DataExplorerContextType` + `ContextType extends` (adds only `table`). Consumers guess which to use.

```ts
// Single name:
export interface DataExplorerContextValue<TItem> { table: ReactTable<TableFeatures, TItem>; /* … */ }
```

### 1.3 Remove the shim file
`src/extract-column-config.ts:1-3` re-exports from `src/columns.ts:37-58`. One home (`columns.ts`), one import path. Leave a `deprecated` re-export for one minor if already consumed.

## 2. Types and naming

### 2.1 Make `ContextType<TItem>` honest
`src/context.tsx:7-15` casts `ContextType<unknown>` to `ContextType<TItem>`. `table` stays `Record<string,unknown>`, so `row.original` is untyped downstream.

```ts
// provider.tsx
const typedTable = table as unknown as ReactTable<typeof TableFeatures, TItem>;
const contextValue: ContextType<TItem> = useMemo(() => ({ table: typedTable, /* … */ }), […]);
```

Perf: zero-cost (type-only), removes per-consumer casts.

### 2.2 Export `ProviderProps<TItem>`
`src/provider.tsx:21-44` inlines the props object. It cannot be imported, extended, or documented.

```ts
export interface DataExplorerProviderProps<TItem extends Record<string, unknown>> {
  children: React.ReactNode;
  columns: ColumnDef<typeof TableFeatures, TItem>[];
  /** Applied once as table `initialState`. Changes after mount are ignored — see §3.2. */
  defaultDisplay: FilterViewDisplay;
  domain: string;
  getRowId: (row: TItem) => string;
  onMove?: BoardMoveHandler;
  query: (opts: RefineOptions) => UseQueryOptions<ListQueryResult<TItem>>;
  viewAdapter?: ViewAdapter;
  /** @default 20 */
  pageSize?: number;
}
export function Provider<TItem extends Record<string, unknown>>(props: DataExplorerProviderProps<TItem>) { /* … */ }
```

Also extract `BoardMoveHandler`, `Density`, `ViewType` unions already exist — reuse them instead of inline `"asc"|"desc"` in `src/query.ts:21`.

### 2.3 Unify operator helpers
Three overlapping seams: `operators.ts` (catalog), `filter-semantics.ts` (policy), `filter-draft.ts` (commit). Good split, but names overlap: `operatorSkipsValue` vs `requiresValue` vs `isNullaryOperator` all answer "needs value?".

Keep one predicate per question and deprecate aliases:
`requiresValue(op)` (UI gating), `isNullaryOperator(op)` (arity check), `getOperatorArity(op)` (switch). Document which to use in TSDoc. No runtime cost.

### 2.4 Type filter values
`FilterCondition.value: unknown` (`src/filters.ts:25-31`) pushes all validation to runtime. Add a distributive helper without breaking storage:

```ts
export type TypedFilterValue<T extends ColumnDataType> =
  T extends "number" ? number | [number, number] | null :
  T extends "boolean" ? boolean | null :
  T extends "date" ? string | [string, string] | null : unknown;

export function createFilter<T extends ColumnDataType>(columnId: string, operator: FilterOperator, value: TypedFilterValue<T>): FilterCondition {
  return { columnId, combinator: "and", id: nanoid(), operator, value };
}
```

Gives autocomplete; stored shape stays `FilterCondition`.

## 3. Provider + data layer (`src/provider.tsx`, `src/hooks/use-data-query.ts`)

### 3.1 Stop mutating `table.options.data`
`src/hooks/use-data-query.ts:99-100`:
```ts
(table.options as unknown as { data: TItem[] }).data = allItems;
```
This bypasses React state, breaks StrictMode/concurrent snapshots, and forces consumers to read stale `table.getRowModel()`.

Fix (perf-neutral, one memo):
```ts
// provider.tsx
const { allItems, query } = useDataQuery({ /* … */ });
const table = useTable({ columns, data: allItems, /* … */ initialState });
```
If TanStack v9 beta requires stable `data` ref, pass `allItems` (already memoized on `[query.data]`) — do not assign post-hoc. If incremental pages must not reset selection, enable `autoResetAll: false` explicitly so the intent is visible.

### 3.2 Document / fix `initialState` staleness
`src/provider.tsx:46-52` builds `initialState` with `useMemo`, but `useTable` consumes it only on mount. Changing `defaultDisplay` or `columns` later silently no-ops.

Options (pick one, document it):
- (a) Explicit uncontrolled: freeze after mount + dev-only warn on change.
- (b) Controlled: `useEffect(() => applyDisplaySnapshot(defaultDisplay, table, columnsConfig), [defaultDisplay])`.
- (c) Keyed reset: `<Provider key={domain} …>`.

Also `useMemo(() => extractColumnConfigs(columns), [columns])` (`provider.tsx:45`) recomputes when the consumer passes an inline `columns` array. Stabilize with a shallow id-join memo or require `useMemo` in docs.

### 3.3 Guard `QueryClientProvider`
`Provider` calls `useInfiniteQuery`/`useQuery` with no ancestor check. Missing provider throws a cryptic TanStack error.

```ts
// top of Provider
if (!useQueryClientSafe()) throw new DataExplorerError("MISSING_QUERY_CLIENT", "Wrap <Provider> in <QueryClientProvider>.");
```

### 3.4 Stabilize `queryKey`, make paging configurable
`src/hooks/use-data-query.ts:80-93` embeds raw `columnSizing`, `columnVisibility`, `dataFilters` objects. Structurally hashed by TanStack, but a new `dataFilters` array identity per keystroke still refetches per keystroke.

```ts
export const DEFAULT_PAGE_SIZE = 20;
// provider accepts pageSize, passes to useDataQuery → limit + queryKey
queryKey: ["data-explorer", domain, hashRefine({ columnSizing, columnVisibility, dataFilters, density, grouping, sorting, viewType })]
// hashRefine = stableStringify (already exported from filter-merge.ts:6)
```

Add `staleTime`/`debounceFiltersMs` passthrough. Perf win: fewer network round-trips during filter typing with zero extra deps.

### 3.5 Fail fast on `queryBuilder` contract
`use-data-query.ts:72-78` throws only when `queryFn` is missing, after building the key. Validate once and name the builder:

```ts
const built = queryBuilder({ /* … */ });
if (typeof built.queryFn !== "function" || !built.queryKey)
  throw new DataExplorerError("INVALID_QUERY_OPTIONS", "query() must return { queryKey, queryFn }.");
return built.queryFn({ queryKey: built.queryKey, signal } as QueryFunctionContext);
```
Note: current code discards `built.queryKey` and reuses the outer key — either honor `built.queryKey` or remove it from the contract. Today both exist and disagree.

## 4. Filter authoring (`dataFilteringFeature`, `operators`, `filter-draft`, `use-inline-filter-flow`)

### 4.1 Return a namespaced flow object, hide raw setters
`use-inline-filter-flow.ts:153-169` returns 16 flat keys including `setInputValue`/`setPendingValue` that bypass `commitDraft` validation.

```ts
return {
  state: { phase, inputValue, selectedColumn, selectedColumnId, selectedOperator, pendingValue, needsNullValue },
  actions: { commit, reset, handleColumnSelect, handleOperatorSelect, handleInputChange, handleQuickValueSelect, setPendingValue },
};
// setInputValue stays internal; input changes go through handleInputChange so idle→column transitions can't be skipped.
```

Consider `useReducer` for `idle→column→operator→value` — 5 `useState`s + 6 callbacks re-create closures per keystroke. Reducer + `useCallback` keeps child input components from re-rendering.

### 4.2 Surface commit errors
`commit()` (`use-inline-filter-flow.ts:52-72`) silently returns on `!result.ok`. UI cannot show "A value is required" / tuple errors.

```ts
const [error, setError] = useState<string | null>(null);
// on commit: if (!result.ok) { setError(result.error); return; }
return { state: { …, error }, actions: { …, clearError } };
```

### 4.3 Document `SEARCH_COLUMN_ID` divergence
`columns.ts:11`, `filter-draft.ts:58-60`, `filter-sql.ts:68-76` special-case `_search` (pinned `contains`, jumps to value, fans out to `ILIKE … OR …`). Add TSDoc on `SEARCH_COLUMN_ID` + a `createSearchFilter(term)` helper so consumers never hand-build `{ columnId: "_search", operator: "contains" }`.

### 4.4 Clarify `include` vs `includeAll`, `exclude` vs `excludeAll`
`sql/filter-sql.ts:158-165` maps both `include` and `includeAll` to `@>`, both `exclude`/`excludeAll` to `NOT(@>)`. If intentional duplicates, deprecate one; if `include` should mean single-element containment, fix the builder. Same for `formatFilterValue` (`filter-draft.ts:107-121`) which groups `set|array` together.

## 5. Merge, grouping, serialization

### 5.1 Keep `stableStringify` but cap it
`filter-merge.ts:6-18` is correct and already reused for keys. Hot path note: it recurses over every filter value on every `mergeFilters`/`filterKey` call. Add a fast path (`typeof value !== "object" → JSON.stringify`) — already there — and avoid calling `filterKey` twice per item in `mergeFilters`/`computeOverrides` (cache `key` in a local `Map`).

### 5.2 Revive `Date` on deserialize
`filter-utils.ts:17-26` serializes `Date → ISO`, but `deserializeFilters` (`:28-49`) never revives. Round-trip breaks `stableStringify` (`Date:…` vs string) and SQL params.

```ts
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
value: typeof s.v === "string" && ISO_DATE.test(s.v) ? new Date(s.v) : s.v
// + schema version field: { v: 1, filters: […] } so future arity changes don't break stored views.
```

### 5.3 Compact display URL encoding
`display-snapshot.ts:95-108` puts `widths` as raw `JSON.stringify` in `URLSearchParams` (verbose, `"`/`{}` percent-encoded). For share links:

```ts
params.set("widths", btoa(JSON.stringify(display.columnWidths))); // or omit defaults
// deserialize tries base64 → JSON, falls back to legacy JSON, then defaults.
```
Also `toInitialSorting`/`toInitialGrouping` (`:9-17`) keep only the first entry — document "single-sort / single-group" or extend `FilterViewDisplay` to `orderBy: {id,dir}[]`.

## 6. SQL builder (`src/sql/filter-sql.ts`)

Biggest DX + correctness item. Current builder is Postgres-only and throws plain `Error`.

### 6.1 Add `dialect` option (default preserves behavior)
```ts
export interface BuildFilterOptions {
  placeholderStyle?: "numbered" | "positional";
  tableAlias?: string;
  dialect?: "postgres" | "sqlite" | "mysql";
  caseSensitive?: boolean; // default false → ILIKE / LOWER(col) LIKE
}
// sqlite: LIKE … ESCAPE '\', text[] ops → json_each / INSTR checks with clear error if multiEnum used.
```
Without this, `buildFilterWhere` silently generates un-runnable SQL on SQLite/MySQL.

### 6.2 Fix `isEmpty` semantics + empty `IN`
- `isEmpty: col => ${col} IS NULL` (`:167`) misses `''`. For `string` columns emit `(${col} IS NULL OR ${col} = '')`; keep `IS NULL` for others. Needs column type — thread `columnsConfig` lookup already available in `buildConditionSql`.
- `in: … IN (${arrayPlaceholders})` (`:163`) with `[]` emits `IN ()` (syntax error). Emit `(1=0)` / `(1=1)` for empty `IN`/`NOT IN`, or reject in `validateConditions` via `filter-semantics.ts`.

### 6.3 Typed errors with column context
```ts
throw new FilterSqlError("UNKNOWN_COLUMN", `Unknown column: "${cond.columnId}"`, { columnId: cond.columnId });
```
Callers can then highlight the offending chip instead of parsing `error.message`. Same for `MISSING_MAPPING`, `EMPTY_GROUP`, `NO_SEARCHABLE_COLUMN`.

### 6.4 Return empty-string contract, not `undefined`
`buildFilterWhere` (`:267-294`) returns `ParameterizedSql | undefined` on zero filters, forcing every caller to branch. Return `{ sql: "", params: [] }` + `isEmpty` helper, or keep `undefined` but export `hasFilters()`. Pick one and document.

Perf note: builder already streams params via `pushParam` with a single `ctx` — keep that; do not switch to string interpolation. Only addition: pre-size `params` via `conditions.length` hint when large.

## 7. Views (`src/hooks/use-view.ts`, `src/features/display-snapshot.ts`)

```ts
// useView return — add status + full CRUD
return { activeView, activeViewId, views, isLoading: viewsLoading, error,
  applyView, resetToSaved, resetToDefault, saveView,
  saveViewAs: (name: string) => Promise<View>, // needs adapter.createView
  createView: …, deleteView: …, renameView: … };
```

- `applyView` (`:64-82`) and `resetToSaved` (`:97-104`) fail silently on unknown id / loading. Return `"applied" | "reset-to-default" | "deferred-loading" | "unknown-id"` or accept `onUnknownId` callback so UI can toast.
- `saveView` (`:84-95`) takes no args (active-view-only) and invalidates the whole `["data-explorer","views",domain]` key — fine for correctness, wasteful on large view lists. Export the key factory: `viewQueryKey(domain)` so consumers can prefetch.
- `applyDisplaySnapshot` (`display-snapshot.ts:62-74`) fires 6 sequential setters → 6 renders. Wrap in `React.startTransition` or TanStack batch (`table.batch?`) / single `setState` if the beta supports it. Comment already notes "single transaction" — make it actually atomic.

## 8. Selection + context (`src/hooks/use-selection.ts`, `src/context.tsx`)

Split the memo so row enumeration doesn't rerun on selection toggles, and stabilize `Set` identity:

```ts
const allRowIds = useMemo(() => table.getRowModel().flatRows.map(r => r.id), [table, query.data]);
// selectedRowIds memo on [rowSelection] only; expose has(id) + array snapshot separately
return useMemo(() => ({
  allSelected: allRowIds.length > 0 && selectedCount === allRowIds.length,
  clearSelection, selectAll, toggleRowSelection,
  selectedCount, selectedRowIds, isSelected: (id: string) => selectedRowIds.has(id),
}), […]);
```

Also `selectAll: toggleAllRowsSelected(true)` selects only loaded pages — rename to `selectLoadedRows` or document pagination scope. `clearSelection: resetRowSelection()` is global — asymmetric and surprising.

`useDataExplorerContext` (`context.tsx:7-15`) throws a generic `Error`. Export a dedicated `MissingProviderError` and include the hook name dynamically so copy-pasted `useSelectionContext` failures point correctly.

## 9. Validation, logging, errors

- `columns.ts:43-53` uses `console.warn` + skip for missing `id`/`displayName`/`type`. In dev, throw (fail fast); in prod, collect: `extractColumnConfigs(defs): { configs, issues: ColumnIssue[] }` overload, keep current signature as `configs`-only wrapper. Never `console.*` from a library — add `onInvalidColumn?: (issue) => void` prop.
- `filter-condition-schema.ts:6-21` validates operator/value without column type (comment admits it). Export `makeFilterConditionSchema(columnsConfig)` that also checks `columnId ∈ config` + `operator ∈ operators[type]` so form-level `zod` errors match `validateConditions` server errors.
- Introduce `DataExplorerError extends Error { code: "…" }` with a `codes.ts`. String-message throws in `filter-sql.ts`, `filter-utils.ts:34-40`, `use-data-query.ts:73` become matchable without regex.

## 10. Docs + discoverability

1. Replace `package/README.md` (currently `bun init` stub) with: install, minimal `Provider` wiring (5-line), `query()` example returning `{ queryKey, queryFn }`, one `buildFilterWhere` Postgres + SQLite example, view persistence example. Link to `docs/CONTEXT.md` terms.
2. Add TSDoc to every export in `index.ts` — at minimum `Provider`, `useView`, `useInlineFilterFlow`, `buildFilterWhere`, `FilterCondition`, `ColumnConfig`. Editors are the primary docs for a headless lib.
3. Export key factories + constants consumers need for cache control: `dataQueryKey(domain, refine)`, `viewQueryKey(domain)`, `PAGE_SIZE`/`DEFAULT_PAGE_SIZE`, `SEARCH_COLUMN_ID`, `DENSITIES`, `VIEW_TYPES`.
4. Publish an `examples/`-style snippet per hook in JSDoc (copy-paste runnable), not just prose.

## 11. Performance checklist (what to keep + what to change)

Keep:
- `allItems` memo on `[query.data]` (`use-data-query.ts:94-98`) + direct table feed — avoids lagged `useState` copy.
- `flagsRef` pattern in `use-load-more.ts:11-12` — avoids re-creating `IntersectionObserver` per fetch state change. Good.
- `stableStringify` + multiset merge (`filter-merge.ts`) — duplicate-safe without sorting inputs.
- Single-pass `groupConditions` (`filter-grouping.ts`) — O(n), deterministic ids.

Change:
- `provider.tsx:108-133` `contextValue` memo deps include `viewHook` (new object every `useView` render → every consumer re-renders). Return stable callbacks from `useView` (already `useCallback`) and memo the returned object on primitives, or split context into `DataContext` + `ViewContext` so scrolling rows doesn't re-render view pickers.
- Same for `typedTable` — `table` instance is stable, but the `as unknown as` cast recreates nothing; ensure `contextValue` deps use `table` not `typedTable` alias churn.
- `useSelectionContext` — see §8. Fresh `Set` per keystroke invalidates `React.memo` rows; expose `isSelected(id)` + `selectedCount` for row-level memoization.
- `useInlineFilterFlow` — move `getColumn` linear scan (`columnsConfig.find` per select) to a `Map` memo when `columnsConfig.length > ~50`.
- `buildFilterWhere` — `columnMap` rebuilt per call (`filter-sql.ts:60`); accept a prebuilt `Map` overload for servers building many queries per request.

---

## Suggested implementation order

1. Errors + `ProviderProps` + explicit `index.ts` exports (unblocks all other DX).
2. `table.options.data` fix + context split (correctness + render perf).
3. SQL `dialect` + `isEmpty`/`IN ()` fixes (correctness for non-Postgres consumers).
4. `useView` status/return-code + `saveViewAs` (unblocks UI work).
5. Serialization revival + compact display URLs (share-link correctness).
6. README + TSDoc pass (adoption).
