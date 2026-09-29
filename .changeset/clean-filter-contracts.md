---
"@adistack/data-explorer": minor
---

Restructure filter, query-key, view, and serialization internals without changing the happy-path behavior:

- Narrow `DataQueryKeyRefine` (and `dataQueryKey`) to data-affecting slices (`dataFilters`, `sorting`, `grouping`). Display-only state (`columnSizing`, `columnVisibility`, `density`, `viewType`) still reaches the `queryBuilder` but no longer busts the infinite-query cache. Skip the debounce sync write when `debounceFiltersMs` is off.
- Unify SQL validation on the column-aware `makeFilterConditionSchema` (which now also enforces the non-empty `_search` string rule); `validateConditions` maps the first issue to `UNKNOWN_COLUMN` / `INVALID_OPERATOR` / `INVALID_FILTER_VALUE`.
- Collapse arity helpers to `getOperatorArity`: remove `isNullaryOperator`, `isRangeOperator`, `requiresArrayValue`, `requiresValue`, `isValidOperatorValue`, `validateOperatorValue`, and `isSearchDraft`. Move the quick-add operator choice into `quickAddCondition` in `filter-draft.ts`.
- Rewrite `useInlineFilterFlow` on a `useReducer` transition table so every phase advance clears inputs in one place; `setPendingValue` is now a plain-value write (no `SetStateAction` confusion).
- Bound `groupConditions` ids with a short hash and drop the unreachable single-segment `or` branch.
- Make `useView` atomic (`startTransition` over filters + display), extract the `viewsPending` guard, and throw `VIEWS_NOT_CONFIGURED` for missing adapters/methods (`saveView` still returns `false` with no active view).
- Strict `deserializeFilters`: reject invalid combinators with `INVALID_FILTER_JSON` and round-trip `Date`s nested in arrays (range tuples).
- Remove the `mergeDisplay` re-export from `filter-merge.ts` (canonical home is `display-snapshot.ts`); make `types.ts` re-exports explicit; fix `isFilterGroup` to accept `unknown`.
