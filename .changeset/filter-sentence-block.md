---
"@adistack/data-explorer-ui": minor
---

Add the `data-explorer-filter-sentence` registry block: saved filters rendered as a plain-language sentence ("Tasks whose status is todo and priority is high") that morphs in place into a Where/And/Or builder via a shared-element Edit ↔ Save transition (first registry block to use `motion`; reduced-motion users get `duration: 0`).

The block is headless-wired like `FilterBar`: Edit snapshots `table.state.dataFilters` into a local draft, and Save validates every row (`validateCondition`) before committing atomically with `table.setDataFilters(draft)` — leaving without Save is an implicit discard, and blank values are blocked at Save instead of coerced away. It reuses `OperatorSelector`/`ValueInput` from the filter-bar block via preserved relative imports (so `data-explorer-filter-bar` is a registry dependency), maps display-string operators to the canonical `FilterOperator` catalog (`getOperatorsForType`/`getOperatorLabel`/`getDefaultOperator`), and renders unknown/stale columns degraded rather than throwing. `SentenceView` is also exported standalone for rendering the prose without the morph.

Also added to the `data-explorer` aggregator's `registryDependencies`, exposed in the examples app (`filter-sentence` demo with a "Save as view" affordance wired through `useView().createView`), and `motion` added to the UI workspace dependencies.
