---
"@adistack/data-explorer": minor
---

Apply the thermo-nuclear code-quality review to `package/` without changing happy-path behavior:

- Delete the dead reconciliation layer: remove `filter-merge.ts` (`mergeFilters`, `computeOverrides`, `filterKey`, `conditionsEqual`) and its test, which had no production callers. `stableStringify` moves to its canonical home in `query.ts` alongside `dataQueryKey` / `hashRefine` / `DataQueryKeyRefine` (still re-exported through `use-data-query.ts`); new `query.test.ts` covers the moved key helpers.
- Delete deprecated aliases with no callers: `PAGE_SIZE` (use `DEFAULT_PAGE_SIZE`), `DataExplorerContextType` (use `DataExplorerContextValue`), `SelectionState.selectAll` (use `selectLoadedRows`), and the `extract-column-config.ts` shim (import from `columns.ts`); drop both deleted files from `registry.json`.
- Fix the `use-data-query` split brain: the wrapper owns the cache key and now passes the outer `dataQueryKey` to the builder's `queryFn` so cache and network never diverge (the builder's `queryKey` is still required by the `{ queryKey, queryFn }` contract). Extract the debounce state into `useDebouncedFilters`, inert when debouncing is off.
- Collapse `filter-sql` indirection: dialect factories become pure `quoteIdent` / `buildLikeFrag` / `assertArraySupported` functions, `include`/`exclude` canonicalize once to `includeAll`/`excludeAll` so the operator table only carries canonical names, `_search` reuses the regular `contains` path per column, and `validateConditions` branches on structure (column lookup, operator membership, `validateFilterValue`) instead of sniffing zod message text.
- Unify the inline filter flow: one `column/select` reducer action (phase chosen by the caller so search still skips to value and normal columns still land on operator), and nullary commits route through `commitDraft` instead of a second ad-hoc path.
- Simplify `use-view`: one derived `viewsStatus` (`disabled`/`loading`/`ready`) replaces the overlapping flags, and one `requireAdapterMethod` helper replaces the three copy-pasted missing-method guards (`saveView` still returns `false` with no active view; `deleteView` still returns `true`).
- Make operator facts explicit: one canonical `OPERATOR_DEFS` table plus explicit `DEFAULT_OPERATORS` (same defaults and first-wins labels as before), so shared-operator metadata can't shift with record ordering.
- Fix the display codec boundary: `serializeDisplay`/`deserializeDisplay` export only from `display-snapshot.ts` (removed the second path through `filter-utils.ts`), `mergeDisplay` deep-merges `columnWidths` per column, and width decoding goes through one `safeJsonParse`.
- Fix `filter-utils` Date handling: `serializeValue`/`reviveValue` recurse into plain objects as well as arrays.
- Unify blank semantics: one `isBlankValue` check drives both `validateFilterValue` (single-arity) and `coerceFilterValue`; set/array validation still accepts empty arrays so empty `IN ()` keeps rendering `(1=0)`.
- Stabilize `Provider`: `onMove` rides a ref so inlining the handler no longer re-renders every consumer (presence still comes from the prop); add `isSearchColumnId` alongside `isSearchColumn`.
