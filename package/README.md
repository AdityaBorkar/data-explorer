# `@adistack/data-explorer`

Headless data-explorer core: TanStack-powered table state (filtering,
display, selection, persisted views) plus a filter → parameterized SQL
helper. UI lives in `@adistack/data-explorer-ui`; this package ships no
DOM. Terms below follow `docs/CONTEXT.md` (Filter Condition, Display,
View, View Type, Density, Selection, Board Move).

## Install

```bash
bun add @adistack/data-explorer @tanstack/react-query @tanstack/react-table react
```

## Minimal wiring

```tsx
import { Provider } from "@adistack/data-explorer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const client = new QueryClient();

<QueryClientProvider client={client}>
  <Provider
    columns={columns}
    defaultDisplay={DEFAULT_DISPLAY}
    domain="tasks"
    getRowId={(row) => row.id}
    query={query}
  >
    {children}
  </Provider>
</QueryClientProvider>
```

`defaultDisplay` is applied once as table `initialState` (uncontrolled):
later changes are ignored — apply updates via `applyDisplaySnapshot` /
table APIs, or key the provider (`<Provider key={domain}>`) for a reset.
Memoize `columns` to avoid recomputing `columnsConfig` per render.

## `query()` — paged data source

```ts
import type { ListQueryResult, RefineOptions } from "@adistack/data-explorer";
import type { UseQueryOptions } from "@tanstack/react-query";

const query = (opts: RefineOptions): UseQueryOptions<ListQueryResult<Task>> => ({
  queryFn: async () => fetchPage(opts), // { filters, sorting, orderBy, limit, cursor, … }
  queryKey: ["tasks", opts.filters],
});
```

`query()` must return `{ queryKey, queryFn }` — anything else throws
`DataExplorerError("INVALID_QUERY_OPTIONS")`. Paging: `pageSize` prop
(default `DEFAULT_PAGE_SIZE`, 20), `staleTime` / `debounceFiltersMs`
passthroughs. Cache keys: `dataQueryKey(domain, refine)`,
`viewQueryKey(domain)`. Only data-affecting slices (`dataFilters`,
`sorting`, `grouping`) enter the data key — display-only state never
invalidates cached pages.

## `buildFilterWhere` — Postgres + SQLite

```ts
import { buildFilterWhere } from "@adistack/data-explorer";

// Postgres (default): ILIKE, text[] @>, $n
buildFilterWhere(filters, columns, mapping, { tableAlias: "tasks" });
// → { sql: '("tasks"."title" ILIKE $1 ESCAPE \'\\\')', params: ["%x%"] }

// SQLite: LOWER(col) LIKE, ? placeholders (array ops throw UNSUPPORTED_DIALECT)
buildFilterWhere(filters, columns, mapping, { dialect: "sqlite" });
// Empty filters → { sql: "", params: [] } (never undefined)
```

`isEmpty` on text matches `NULL` or `''`; empty `IN ()` becomes `(1=0)`
(and `NOT IN` → `(1=1)`). Failures throw `DataExplorerError` with a stable
`code` (`UNKNOWN_COLUMN`, `MISSING_MAPPING`, …) and the offending
`columnId` in `details` — highlight the chip instead of parsing messages.

### `backend` — Postgres-only server entry

```ts
import { buildFilterWherePg, pgColRef } from "@adistack/data-explorer/backend";

// $n numbered placeholders, ILIKE … ESCAPE '\', text[] @>/&&, ANSI "ident" quoting
buildFilterWherePg(filters, columns, mapping, { tableAlias: "tasks" });
// → { sql: '"tasks"."title" ILIKE $1 ESCAPE \'\'…', params: ["%x%"] }

// Compose identifiers (e.g. ORDER BY) with the same quoting rules:
pgColRef("estimate", "tasks"); // → '"tasks"."estimate"'
```

`./backend` is a wrapper over the same engine pinned to Postgres: the
transitive import closure is React / TanStack / zod free (enforced by
`sql/no-ui-imports.test.ts`), so Bun server bundles can import it
directly. `caseSensitive: true` switches to binary `LIKE`; there is no
`dialect` / `placeholderStyle` option. Pass `caseSensitive`, `tableAlias`
only — for the multi-dialect builder use the root export. Empty filters →
`{ sql: "", params: [] }` (never undefined).

## Persisted views

```tsx
const viewAdapter: ViewAdapter = {
  listViews: (domain) => load(domain),
  updateView: (id, data) => save(id, data),
  createView: (domain, data) => insert(domain, data), // optional: enables createView
};

const { views, applyView, createView } = useView({
  columnsConfig, defaultDisplay, domain, table, viewAdapter,
});
applyView("backlog"); // void — read `isLoading` / `views` to toast on unknown ids
```

`saveView()` persists the active view; `createView(name)` creates one (omitted `display`/`refine` snapshots from the table).
With no active view, `resetToSaved()` falls back to `defaultDisplay` +
empty filters. Share links: `serializeFilters` (versioned, revives
`Date`s) and `serializeDisplay` (raw JSON widths; legacy `b64:` links still decode).

## Errors

```ts
import { DataExplorerError } from "@adistack/data-explorer";

try {
  /* … */
} catch (error) {
  if (error instanceof DataExplorerError) error.code; // matchable, documented in errors.ts
}
```

Invalid column definitions are skipped and reported via the
`onInvalidColumn` prop (`strictColumns` throws instead) — the library
never logs.
