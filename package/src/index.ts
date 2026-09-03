// Domain models + context shape (types.ts re-exports the domain barrels).

export { extractColumnConfigs } from "./columns.ts";
export type { SelectionState } from "./context.tsx";
// Context + provider shell. Selection lives in `./hooks/use-selection.ts`
// and is re-exported through `./context.tsx`, so export it once here.
export {
	DataExplorerContext,
	useDataExplorerContext,
	useSelectionContext,
} from "./context.tsx";
// Features.
export { dataFilteringFeature } from "./features/data-filtering/dataFilteringFeature.ts";
export { filterConditionSchema } from "./features/data-filtering/filter-condition-schema.ts";
export * from "./features/data-filtering/filter-draft.ts";
export { groupConditions } from "./features/data-filtering/filter-grouping.ts";
export {
	computeOverrides,
	conditionsEqual,
	filterKey,
	mergeDisplay,
	mergeFilters,
	stableStringify,
} from "./features/data-filtering/filter-merge.ts";
export * from "./features/data-filtering/filter-semantics.ts";
export {
	deserializeDisplay,
	deserializeFilters,
	serializeDisplay,
	serializeFilters,
} from "./features/data-filtering/filter-utils.ts";
export * from "./features/data-filtering/operators.ts";
export { useInlineFilterFlow } from "./features/data-filtering/use-inline-filter-flow.ts";
export { displayMetaFeature } from "./features/display-meta/displayMetaFeature.ts";
export {
	applyDisplaySnapshot,
	toDisplaySnapshot,
	toInitialTableState,
} from "./features/display-snapshot.ts";
// Hooks.
export { useDataQuery } from "./hooks/use-data-query.ts";
export { useLoadMore } from "./hooks/use-load-more.ts";
export { useView } from "./hooks/use-view.ts";
export { Provider, Provider as DataExplorerProvider } from "./provider.tsx";
// SQL helper.
export * from "./sql/index.ts";
export * from "./types.ts";
