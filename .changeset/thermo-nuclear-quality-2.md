---
"@adistack/data-explorer": minor
---

Apply the thermo-nuclear review, part 2 — delete indirection, unify validation, fix stale state:

- Remove `types.ts` as a second barrel: it now owns the context shape only (`BoardMove*`, `DataExplorerViewState`, `DataExplorerContextValue`, `TableFeatures`). Every module imports from its canonical home (`columns.ts`, `filters.ts`, `query.ts`, `views.ts`); `index.ts` exports query-key helpers directly from `query.ts`.
- Delete `include` / `exclude` from the `FilterOperator` union. The canonical names are `includeAll` / `excludeAll` (also the new `multiEnum` default); historical stored filters still deserialize via `normalizeOperator` (new export) at the `deserializeFilters` boundary and defensively in SQL.
- Unify validation behind `validateCondition` (new export in `filter-semantics.ts`): the SQL builder throws `DataExplorerError` from it and `makeFilterConditionSchema` maps it to zod issues, so rule edits land in one place.
- Delete `DialectImpl` / `resolveDialect` in `filter-sql.ts`: three pure functions (`quoteIdent`, `buildLike`, `assertArraySupported`) take the dialect directly, builders receive the full condition (real `columnId` in error details), and the operator table is exhaustive with no casts.
- Fix `use-view` stale ids: unknown view ids clear `activeViewId` instead of stranding it, one `getAdapterMethod` guard replaces two, one `invalidateViews` helper replaces four inline invalidations, and `applySnapshot` runs filters + display in a single transition.
- Fix `use-data-query`: one `useDebouncedValue` with a single read path replaces the dual-variable debounce, and the query key is hoisted so key and fetch share one reference.
- Unify the inline filter flow: one `commitCondition` path for valued and nullary commits, unknown columns report an error instead of storing a dangling id, and public state extends the reducer state instead of duplicating it.
- Fix `use-selection`: `isSelected` has stable identity (reads current table state lazily; pair with `selectedCount` in memo rows), and `Provider` context `items` reads the same `tableData` reference the table sees.
- Harden the share-link codec: width maps must be finite-number records, legacy `b64:` decoding never throws (Node `Buffer` fallback included), and empty params fall back explicitly.
