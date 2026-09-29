/**
 * Server-safe surface of `@adistack/data-explorer/backend`.
 *
 * Postgres-only filter → SQL construction for Bun/server bundles: the
 * transitive in-package import closure is React / TanStack / zod free
 * (enforced by `./no-ui-imports.test.ts`, not by review). Explicit
 * allow-list, no `export *`.
 *
 * Deliberately excluded: `SqlDialect` / `PlaceholderStyle` /
 * `BuildFilterOptions` (root-compat only — pg is pinned here, unsupported
 * configurations are compile-time errors, not runtime throws);
 * `filter-condition-schema.ts` (zod — server consumers must not pull it);
 * `filter-utils.ts` serialization, hooks, provider, context, views,
 * query keys, display snapshots (client concerns); `createFilter` and the
 * rest of `filter-draft.ts` (nanoid authoring is UI-side — only the pure
 * `createSearchFilter` helper is exposed below).
 */

// --- Columns (../columns.ts) ---
export {
	type ColumnConfig,
	type ColumnDataType,
	isSearchColumnId,
	SEARCH_COLUMN_ID,
} from "../columns.ts";
// --- Errors (subset: NO MissingProviderError — UI-only) ---
export { DataExplorerError, type DataExplorerErrorCode } from "../errors.ts";
// --- Search draft (../features/data-filtering/filter-draft.ts): imports are
// pure (columns/filters/filter-semantics/operators + nanoid only), verified
// by the import-graph test. ---
export { createSearchFilter } from "../features/data-filtering/filter-draft.ts";
// --- Grouping ---
export { groupConditions } from "../features/data-filtering/filter-grouping.ts";
// --- Semantics (filter-semantics.ts: validation Aspen reuses pre-build) ---
export {
	type CoercedFilterValue,
	type ConditionValidationError,
	coerceFilterValue,
	validateCondition,
	validateFilterValue,
} from "../features/data-filtering/filter-semantics.ts";
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
// --- Filters (../filters.ts: predicates + FilterGroup) ---
export {
	type FilterCondition,
	type FilterGroup,
	type FilterOperator,
	hasFilters,
	isFilterGroup,
	type SerializedFilterCondition,
	type TypedFilterValue,
} from "../filters.ts";
// --- Shared SQL types (from ./index.ts — NO dialect/placeholder types) ---
export type { ColumnMapping, ParameterizedSql } from "./index.ts";
// --- Postgres identifiers (./pg-identifiers.ts) ---
export { escapeLikePattern, pgColRef, quotePgIdent } from "./pg-identifiers.ts";
// --- Postgres WHERE (./pg-where.ts) ---
export { type BuildPgWhereOptions, buildFilterWherePg } from "./pg-where.ts";
