# SPEC — `@adistack/data-explorer/backend` (Postgres-only server entry)

> Implementation spec for a second, server-safe export of `@adistack/data-explorer`:
> `backend` exposes filter→SQL construction pinned to Postgres, with no React /
> TanStack / zod import chain, so Aspen OS server code (Bun) can import it
> directly instead of vendoring the engine.
>
> Parent context: `recruiter-mg/DATA_EXPLORER_REPORT.md` Strategy A (§3.3, §4.1)
> and `recruiter-mg/SPEC-data-explorer.md` §3 (platform kit vendors the engine
> today under option (a), "sync-by-test", because the SQL helper rides the
> React-peered root export). This spec implements the lighter variant of report
> option (b): same package, new subpath, zero new dependencies. It does **not**
> change the Aspen kit decision by itself — it makes direct import viable and,
> if Aspen still vendors, becomes the trivially-in-sync parity reference.
>
> Postgres only. No SQLite/MySQL surface. Follow `AGENTS.md` (verify order:
> lint → types → test) and repo conventions below.

## 0. Goals / non-goals

Goals:

- G1. `import { buildFilterWherePg } from "@adistack/data-explorer/backend"`
  works in a Bun server bundle without resolving `react`, `react-dom`,
  `@tanstack/*`, or `zod`.
- G2. Postgres-pinned API: `$n` numbered placeholders, `ILIKE … ESCAPE '\'`,
  `text[] @>/&& … ::text[]`, ANSI `"ident"` quoting — with the multi-dialect
  options (`dialect`, `placeholderStyle`) removed from the type surface so
  unsupported configurations are compile-time errors, not runtime
  `UNSUPPORTED_DIALECT` throws.
- G3. Byte-identical `WHERE` output vs the existing root `buildFilterWhere`
  with `{ dialect: "postgres" }` (proven by test, not by review).
- G4. Explicit allow-list barrel (same style as `package/src/index.ts` — no
  `export *`), so the server contract stays tree-shakeable and reviewable.

Non-goals:

- N1. No query **execution**: no driver, no pool, no drizzle/pg coupling.
  Output is `{ sql, params }` text + values; composition with `sql.raw` /
  identifiers happens in Aspen's kit (`SPEC-data-explorer.md` §3.2).
- N2. No `ORDER BY` / keyset / cursor / limit helpers. Those compose with the
  caller's schema and driver (`SPEC-data-explorer.md` §3.4–§3.6 owns them);
  putting a second copy here would split the source of truth.
- N3. No SQLite/MySQL. The existing `sql/filter-sql.ts` keeps its multi-dialect
  implementation untouched for compat (README documents it); `backend` simply
  does not expose the dialect axis.
- N4. No new runtime dependency. `nanoid` (already a dependency, reached via
  `filters.ts`) is the only runtime import in the backend closure.
- N5. No file moves of existing sources (registry `files[].path` entries stay
  valid; only additions).

## 1. Current state (verified — do not re-derive from memory)

- `package/package.json`: sole subpath `".": "./src/index.ts"` (`module`/`types`
  point at source; `files: ["src"]`; `dependencies: nanoid + zod`;
  `peerDependencies: react, react-dom, @tanstack/react-query/table`).
  `AGENTS.md` + ADR-0001 codify the single-export rule; `index.ts` re-exports
  `buildFilterWhere` from `./sql/index.ts` — there is **no** `./sql` subpath.
- `package/src/sql/filter-sql.ts` (426 lines) implements all dialects. Its
  transitive imports are React-free: `../columns.ts` (pure + `errors.ts`),
  `../errors.ts` (pure), `../filters.ts` (**imports `nanoid`** — sole runtime
  dep in the closure), `features/data-filtering/{filter-grouping,
  filter-semantics, operators}.ts` (pure; `filter-condition-schema.ts` (zod) is
  **not** in the closure). The React peers enter only via `index.ts` siblings
  (`provider.tsx`, `context.tsx`, `hooks/*`).
- Semantics already Postgres-correct (report §2.2, code-verified): empty filters
  → `{ sql: "", params: [] }`; `_search` fans `contains` across `searchable`
  columns; `isEmpty` on text → `(NULL OR '')`; empty `IN ()` → `(1=0)` /
  `NOT IN ()` → `(1=1)`; LIKE wildcards escaped (`\%`, `\_`, `\\`); failures are
  `DataExplorerError` matched on `code`.
- `registry.json` `data-explorer-sql` item ships `sql/index.ts` +
  `sql/filter-sql.ts` with relative imports into core. Gap (verify while
  implementing): `data-explorer-core` does **not** list `package/src/errors.ts`
  although `index.ts` re-exports it — the backend item must not repeat that
  mistake (§6).
- Toolchain: TS 7 strict (`verbatimModuleSyntax` → `import type`; relative
  imports keep `.ts` extensions; `noUncheckedIndexedAccess`,
  `noUnusedLocals/Parameters`); kebab-case files; tests are co-located vitest
  run via `bunx vitest run` from `package/` (no config, no `test:unit` script,
  no vitest in CI — run locally); publishable changes require a changeset
  (`bunx changeset`) or `checks.yml` fails; conventional commits
  (`feat|fix|…`, pre-commit `bun fix:format`).

## 2. Package contract changes

```jsonc
// package/package.json
{
  "exports": {
    ".": "./src/index.ts",
    "./backend": "./src/sql/backend.ts",
    "./package.json": "./package.json"
  },
  // "module", "types", "files", "dependencies", "peerDependencies": unchanged.
  // No new runtime dep. Peers unchanged: backend code paths never import them,
  // so they stay inert for server-only consumers (npm may still install peers —
  // accepted, see §9.3; a split zero-peer package is explicitly a non-goal).
}
```

- `files: ["src"]` already covers the new directory — no change.
- `module`/`types` stay root-only (bundlers resolve `./backend` via `exports`).

## 3. File layout (merged into `sql/`)

Deviation from the first draft (which proposed a sibling `backend/` dir):
the backend sources live **inside** `sql/` — `sql/filter-sql.ts` needs
`pg-identifiers.ts` and `pg-where.ts` needs `buildFilterWhere`, so separate
directories would create a `sql ↔ backend` import cycle. One directory, one
closure:

```
package/src/sql/
  index.ts             # root barrel: buildFilterWhere + dialect types (existing)
  filter-sql.ts        # multi-dialect engine (existing; adopts pg-identifiers)
  backend.ts           # allow-list barrel, no `export *`            (new)
  pg-where.ts          # buildFilterWherePg + BuildPgWhereOptions    (new)
  pg-identifiers.ts    # quotePgIdent / pgColRef / escapeLikePattern (new, zero imports)
  pg-where.test.ts       (new)  pg-identifiers.test.ts       (new)
  no-ui-imports.test.ts  (new, §7)
```

- `pg-identifiers.ts` is a dependency leaf (no imports). `filter-sql.ts`
  is refactored **mechanically** to import `ansiQuote`-equivalent +
  `escapeLikePattern` from it instead of its locals; the refactor must be
  output-identical (existing `filter-sql.test.ts` passes **unchanged** —
  that file is the guard, do not edit it in this change).
- No existing file moves, no existing export renames, no `index.ts` changes
  (root keeps exporting the multi-dialect helper for compat).

## 4. Backend barrel allow-list (`sql/backend.ts`)

Mirror `index.ts` style (grouped, `import type` for types). Exact surface:

```ts
// --- Postgres WHERE (./pg-where.ts) ---
export { buildFilterWherePg, type BuildPgWhereOptions } from "./pg-where.ts";
// --- Postgres identifiers (./pg-identifiers.ts) ---
export { escapeLikePattern, pgColRef, quotePgIdent } from "./pg-identifiers.ts";
// --- Shared SQL types (from ./index.ts — NO dialect/placeholder types) ---
export { type ColumnMapping, type ParameterizedSql } from "./index.ts";
// --- Filters (../filters.ts: predicates + FilterGroup; EXCLUDES createFilter (nanoid authoring is UI-side)) ---
export {
  hasFilters,
  isFilterGroup,
  type FilterCondition,
  type FilterGroup,
  type FilterOperator,
  type SerializedFilterCondition,
  type TypedFilterValue,
} from "../filters.ts";
// --- Search draft (../features/data-filtering/filter-draft.ts) ---
// VERIFY at authoring time that this module's imports are pure (no UI/flow chain);
// if it pulls anything outside §8, drop createSearchFilter here and let callers
// hand-build `{ columnId: "_search", operator: "contains", … }` instead.
export { createSearchFilter } from "../features/data-filtering/filter-draft.ts";
// --- Columns (../columns.ts) ---
export {
  isSearchColumnId,
  SEARCH_COLUMN_ID,
  type ColumnConfig,
  type ColumnDataType,
} from "../columns.ts";
// --- Operators (../features/data-filtering/operators.ts) ---
export {
  FILTER_OPERATORS,
  getDefaultOperator,
  getOperatorArity,
  getOperatorLabel,
  getOperatorsForType,
  normalizeOperator,
  type OperatorArity,
} from "../features/data-filtering/operators.ts";
// --- Semantics (filter-semantics.ts: validation Aspen reuses pre-build) ---
export {
  coerceFilterValue,
  validateCondition,
  validateFilterValue,
  type CoercedFilterValue,
  type ConditionValidationError,
} from "../features/data-filtering/filter-semantics.ts";
// --- Grouping ---
export { groupConditions } from "../features/data-filtering/filter-grouping.ts";
// --- Errors (subset: NO MissingProviderError — UI-only) ---
export { DataExplorerError, type DataExplorerErrorCode } from "../errors.ts";
```

Deliberately excluded (document in barrel comment): `SqlDialect`,
`PlaceholderStyle`, `BuildFilterOptions` (root-compat only);
`filter-condition-schema.ts` (zod — Aspen forbids zod domain validation,
`SPEC-data-explorer.md` §0); `filter-utils.ts` serialization, hooks, provider,
context, views, query keys, display snapshots (client concerns).

## 5. `pg-where.ts` — the pinned builder

```ts
import type { ColumnConfig } from "../columns.ts";
import type { FilterCondition } from "../filters.ts";
import { buildFilterWhere } from "./index.ts";
import type { ColumnMapping, ParameterizedSql } from "./index.ts";

export interface BuildPgWhereOptions {
  /** `true` → binary `LIKE`; default `false` → `ILIKE`. Only pg semantic kept. */
  caseSensitive?: boolean;
  tableAlias?: string;
}

/** Postgres-only `buildFilterWhere`: `$n` numbered placeholders, always. */
export function buildFilterWherePg(
  conditions: FilterCondition[],
  columnsConfig: ColumnConfig[],
  columnMapping: ColumnMapping,
  options?: BuildPgWhereOptions,
): ParameterizedSql {
  return buildFilterWhere(conditions, columnsConfig, columnMapping, {
    caseSensitive: options?.caseSensitive ?? false,
    dialect: "postgres",
    placeholderStyle: "numbered",
    tableAlias: options?.tableAlias,
  });
}
```

Wrapper (not fork) is the point: parity with root-postgres is structural, and
§8 tests lock it. If a future optimization needs pg-specific SQL that the
shared implementation cannot express, that change gets its own ADR + fork
decision — not this spec.

## 6. `pg-identifiers.ts` — quoting + LIKE escaping (single home)

```ts
/** Quote a Postgres identifier: `name` → `"name"`, embedded `"` doubled. */
export function quotePgIdent(name: string): string;
/** `col` → `"col"`; with alias → `"alias"."col"`. */
export function pgColRef(columnName: string, tableAlias?: string): string;
/** Escape LIKE wildcards so user input matches literally (`\`, `%`, `_`). */
export function escapeLikePattern(value: string): string;
```

Pure string functions, zero imports. `sql/filter-sql.ts` adopts them
(§3 refactor); Aspen's `ORDER BY` composition (`SPEC-data-explorer.md` §3.2)
may use `pgColRef` for the whitelisted column instead of its own quoting.

## 7. Postgres semantics (normative — backend MUST preserve all)

1. Empty input → `{ sql: "", params: [] }` (never `undefined`, never `1=1` text).
2. `WHERE` groups follow `groupConditions` (flat `and/or` → AND-precedence tree).
3. Text matching is `ILIKE … ESCAPE '\'` by default, `LIKE` iff
   `caseSensitive: true`; user `%_\\` escaped before wrapping (`contains` →
   `%v%`, `startsWith` → `v%`, `endsWith` → `%v`).
4. `isEmpty` on `string` → `(col IS NULL OR col = '')`, else `col IS NULL`
   (mirror for `isNotEmpty`); nullary ops ignore `value`.
5. `in([])` → `(1=0)`; `notIn([])` → `(1=1)`; `between/notBetween` require
   2-tuples; `includeAll/excludeAll` → `@>` (+ `NOT (…)`), `includeAny/excludeAny`
   → `&&` with `ARRAY[…]::text[]`.
6. `_search` (`operator: "contains"`, string value) fans out to `OR` across
   `searchable` columns; zero searchable columns → `NO_SEARCHABLE_COLUMN`.
7. Validation precedes codegen (`validateCondition` per condition): unknown id →
   `UNKNOWN_COLUMN` (note: `_search` bypasses the column map but still requires
   a string value); known-but-unmapped → `MISSING_MAPPING`; bad op/value →
   `INVALID_OPERATOR` / `INVALID_FILTER_VALUE`; empty group → `EMPTY_GROUP`.
   `UNSUPPORTED_DIALECT` is never thrown from `backend` (no array-op dialect
   gate remains on the pg path — array ops always target `text[]`).
8. Placeholders are strictly sequential `$1…$n` in param order; one `params`
   entry per `pushParam` call (array-op elements expand individually).

## 8. Import-graph constraint (the actual bug being fixed)

`sql/` backend sources' transitive in-package imports MUST stay within:

```
sql/backend.ts, sql/pg-where.ts, sql/pg-identifiers.ts,
sql/filter-sql.ts, sql/index.ts,
columns.ts, errors.ts, filters.ts,
features/data-filtering/filter-grouping.ts,
features/data-filtering/filter-semantics.ts,
features/data-filtering/operators.ts,
features/data-filtering/filter-draft.ts (createSearchFilter only — VERIFY its imports are pure at authoring time; if it pulls UI/flow code, drop createSearchFilter from §4 instead)
```

Forbidden: `react`, `react-dom`, `@tanstack/*`, `zod`, `provider.tsx`,
`context.tsx`, `hooks/*`, `types.ts`, `features/display-*`,
`features/data-filtering/{filter-condition-schema,dataFilteringFeature*,
filter-utils,use-inline-filter-flow,filter-flow-reducer}.ts`, `components/`.

Enforcement is a test, not a review rule — new
`sql/no-ui-imports.test.ts`: walk relative `./…​.ts` imports from
`sql/backend.ts` (+ `pg-where.ts`, `pg-identifiers.ts`) to fixpoint over
`package/src`, fail on any specifier in the forbidden set or any in-package
file outside the allow-list. (Static source scan — no module loading, so it
runs in the node env like the other pure tests.)

## 9. Registry, docs, release

1. `registry.json`: extend the `data-explorer-sql` item — add
   `package/src/sql/backend.ts`, `sql/pg-where.ts`, `sql/pg-identifiers.ts`
   (targets `components/data-explorer/sql/{backend,pg-where,pg-identifiers}.ts`)
   and `package/src/errors.ts`
   (target `components/data-explorer/errors.ts`; also add `errors.ts` to the
   `data-explorer-core` item — §1 gap fix, call it out in the changeset).
   Update the sql item `description` to mention the `./backend` server entry.
   Keep `files[].path` byte-accurate per `AGENTS.md`.
2. `package/README.md`: extend the `buildFilterWhere` section with a
   `backend` subsection (import path, pg-only contract, `{sql, params}` +
   `pgColRef` composition example, pointer to root for multi-dialect).
3. `AGENTS.md` layout bullet: "sole export" → "two exports (`.` UI +
   `./backend` server-side; backend closure is React-free per
   `sql/no-ui-imports.test.ts`)".
4. New ADR `docs/adr/0004-backend-subpath.md`: exception to ADR-0001
   single-export rule — why a subpath (not a split package: no version skew,
   parity free) and why wrapper (not fork).
5. Changeset: `feat` minor via `bunx changeset` (publishable change outside
   docs/examples → CI requires it).

## 10. Test plan + acceptance

- Authoring: `bun run check:lint` (= `biome check --fix .` from `package/`),
  then `bun run check:types` (`tsc --noEmit`), then
  `bunx vitest run` from `package/` (add single-file runs for new tests).
- New `sql/pg-where.test.ts`: fixture matrix — all 22 canonical operators +
  `include`/`exclude` aliases, `_search` fan-out (multi + single + zero →
  error), nested and/or groups, empty input, LIKE-escape characters, sequential
  `$n` numbering — each case asserting **deep-equal parity** with root
  `buildFilterWhere(…, { dialect: "postgres" })` plus direct snapshot of one
  representative per operator family.
- New `sql/pg-identifiers.test.ts`: `"` doubling, alias qualification,
  no-alias form, escape of `\ % _` (incl. already-escaped input double-pass).
- `sql/no-ui-imports.test.ts` per §8 (must fail if e.g. `provider.tsx` is
  added to the closure).
- Existing `sql/filter-sql.test.ts` passes **unmodified** (guards the §3
  refactor); full suite green; `tsc -b` at repo root clean.
- Acceptance:
  - [ ] `bunx vitest run` green in `package/`; lint + types clean (repo-root
    `tsc -b` too).
  - [ ] A Bun server script importing **only** `@adistack/data-explorer/backend`
    builds WHERE fragments (document the command in the PR) with no
    `react`/`@tanstack`/`zod` in its module graph (test §8 is the standing proof).
  - [ ] `SqlDialect`/`dialect`/`placeholderStyle` are unreferenceable from the
    backend path (type-level: passing `dialect` is a compile error).
  - [ ] registry `files[].path` verified against the tree; changeset present;
    README + AGENTS.md + ADR-0004 landed.

## 11. Open questions (resolve at implementation, do not expand scope)

1. `filter-draft.ts` purity (§8): if `createSearchFilter` drags UI/flow imports,
   drop it from the barrel (callers hand-build `{ columnId: "_search",
   operator: "contains" }`) rather than widening the closure.
2. `errors.ts` in `data-explorer-core` registry item: fix there (§9.1) or only
   reference from the sql/backend item? Prefer fixing core (it is a genuine gap:
   root barrel exports it).
3. Peer-installation ergonomics (§2): if reviewers object to peers installing
   for server-only consumers, the answer is a follow-up split package, not
   scope creep here.
