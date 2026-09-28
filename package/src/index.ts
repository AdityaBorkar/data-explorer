/**
 * Public surface of `@adistack/data-explorer`.
 *
 * Explicit allow-list (no `export *`): every name here is the stable
 * contract — renames elsewhere don't break consumers, and bundlers can
 * tree-shake cleanly. Canonical home per domain:
 * columns → `./columns.ts`, filters → `./filters.ts`, display +
 * share-link codec → `./features/display-snapshot.ts`, filter
 * serialization → `./features/data-filtering/filter-utils.ts`, query keys
 * → `./query.ts` (re-exported through `./hooks/use-data-query.ts`).
 * (`types.ts` is the internal composition root; only the names
 * re-exported here are public.)
 */

// --- Columns (`./columns.ts`) ---
export {
	type ColumnConfig,
	type ColumnDataType,
	type ColumnIssue,
	type DataExplorerColumnMeta,
	type ExtractColumnConfigOptions,
	extractColumnConfigs,
	extractColumnConfigsDetailed,
	isSearchColumn,
	isSearchColumnId,
	SEARCH_COLUMN_ID,
} from "./columns.ts";
// --- Context + provider shell. ---
export {
	DataExplorerContext,
	useDataExplorerContext,
} from "./context.tsx";
// --- Errors (`./errors.ts`): match on `error.code`, never on messages. ---
export {
	DataExplorerError,
	type DataExplorerErrorCode,
	MissingProviderError,
} from "./errors.ts";
// --- Table features. ---
export { dataFilteringFeature } from "./features/data-filtering/dataFilteringFeature.ts";
// --- Filter authoring: schemas, drafts, semantics. ---
export {
	filterConditionSchema,
	makeFilterConditionSchema,
} from "./features/data-filtering/filter-condition-schema.ts";
export {
	buildDraftCondition,
	commitDraft,
	createSearchFilter,
	type DraftCommit,
	editorKind,
	type FilterEditorKind,
	formatFilterValue,
	quickAddCondition,
} from "./features/data-filtering/filter-draft.ts";
export { groupConditions } from "./features/data-filtering/filter-grouping.ts";
export {
	type CoercedFilterValue,
	coerceFilterValue,
	validateFilterValue,
} from "./features/data-filtering/filter-semantics.ts";
export {
	deserializeFilters,
	FILTER_SERIALIZATION_VERSION,
	serializeFilters,
} from "./features/data-filtering/filter-utils.ts";
export {
	FILTER_OPERATORS,
	getDefaultOperator,
	getOperatorArity,
	getOperatorLabel,
	getOperatorsForType,
	type OperatorArity,
} from "./features/data-filtering/operators.ts";
export {
	type InlineFilterActions,
	type InlineFilterState,
	useInlineFilterFlow,
} from "./features/data-filtering/use-inline-filter-flow.ts";
export { displayMetaFeature } from "./features/display-meta/displayMetaFeature.ts";
// --- Display snapshots (canonical home for `mergeDisplay` + share-link codec). ---
export {
	applyDisplaySnapshot,
	DENSITIES,
	deserializeDisplay,
	mergeDisplay,
	serializeDisplay,
	toDisplaySnapshot,
	toInitialColumnVisibility,
	toInitialGrouping,
	toInitialSorting,
	toInitialTableState,
	VIEW_TYPES,
} from "./features/display-snapshot.ts";
// --- Filters (`./filters.ts`) ---
export {
	createFilter,
	type FilterCondition,
	type FilterGroup,
	type FilterOperator,
	hasFilters,
	isFilterGroup,
	type SerializedFilterCondition,
	type TypedFilterValue,
} from "./filters.ts";
// --- Hooks. ---
export {
	type DataQueryKeyRefine,
	DEFAULT_PAGE_SIZE,
	dataQueryKey,
	hashRefine,
	stableStringify,
	useDataQuery,
} from "./hooks/use-data-query.ts";
export { useLoadMore } from "./hooks/use-load-more.ts";
export {
	type SelectionState,
	useSelectionContext,
} from "./hooks/use-selection.ts";
export { useView, viewQueryKey } from "./hooks/use-view.ts";
/** Headless provider — see `DataExplorerProviderProps` for the contract. */
export {
	type DataExplorerProviderProps,
	Provider,
	Provider as DataExplorerProvider,
} from "./provider.tsx";
// --- Query (`./query.ts`) ---
export type {
	DataRefineOptions,
	ListQueryResult,
	RefineOptions,
	SortDirection,
	SortOrder,
} from "./query.ts";
// --- SQL helper. ---
export {
	type BuildFilterOptions,
	buildFilterWhere,
	type ColumnMapping,
	type ParameterizedSql,
	type PlaceholderStyle,
	type SqlDialect,
} from "./sql/index.ts";
// --- Context shape (`./types.ts`) ---
export type {
	BoardMoveArgs,
	BoardMoveHandler,
	DataExplorerContextValue,
	DataExplorerViewState,
	TableFeatures,
} from "./types.ts";
// --- Views (`./views.ts`) ---
export type {
	Density,
	FilterViewDisplay,
	View,
	ViewAdapter,
	ViewType,
} from "./views.ts";
