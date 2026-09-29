import type { GroupingState, SortingState } from "@tanstack/react-table";

import type { FilterCondition } from "./filters.ts";

export interface ListQueryResult<TItem> {
	items: TItem[];
	nextCursor?: string | null;
}

/** Sort direction shared by `orderBy` and TanStack sorting state. */
export type SortDirection = "asc" | "desc";

/** Single-column order descriptor (display snapshots are single-sort; see `toInitialSorting`). */
export interface SortOrder {
	columnId: string;
	direction: SortDirection;
}

export type DataRefineOptions = {
	cursor?: string;
	filters: FilterCondition[];
	grouping: GroupingState;
	limit: number;
	orderBy: SortOrder;
	sorting: SortingState;
};

/**
 * Data refine options for the `query` builder. The builder receives only
 * data-affecting state — display-only state (`columnSizing`,
 * `columnVisibility`, `density`, `viewType`) never enters the data path.
 * Read it from `table.state` directly when a query needs display context.
 *
 * Kept as an alias for backwards compatibility with existing `query`
 * callbacks typed against `RefineOptions`.
 */
export type RefineOptions = DataRefineOptions;

/**
 * Deterministic structural stringify with sorted object keys.
 * Canonical home for cache-key hashing (`hashRefine`, `dataQueryKey`).
 * `Date` values encode as `Date:<iso>`; `undefined` encodes literally so
 * missing vs null stays distinct in keys.
 */
export function stableStringify(value: unknown): string {
	if (value === null) return "null";
	if (value === undefined) return "undefined";
	if (value instanceof Date) return `Date:${value.toISOString()}`;
	if (typeof value !== "object") return JSON.stringify(value) ?? "unknown";
	if (Array.isArray(value)) {
		return `[${value.map((v) => stableStringify(v)).join(",")}]`;
	}
	const entries = Object.entries(value as Record<string, unknown>)
		.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
		.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
	return `{${entries.join(",")}}`;
}

/** Data-affecting refine slice that participates in the query key (`dataFilters`, `sorting`, `grouping`). */
export interface DataQueryKeyRefine {
	dataFilters: FilterCondition[];
	grouping: GroupingState;
	sorting: SortingState;
}

/** Stable structural hash of the refine state (backed by `stableStringify`). */
export function hashRefine(refine: DataQueryKeyRefine): string {
	return stableStringify(refine);
}

/**
 * Cache-key factory for the infinite data query. Prefer this over inline
 * `["data-explorer", domain]` arrays so invalidations stay in sync.
 */
export function dataQueryKey(
	domain: string,
	refine?: DataQueryKeyRefine,
): readonly unknown[] {
	return refine === undefined
		? (["data-explorer", domain] as const)
		: (["data-explorer", domain, hashRefine(refine)] as const);
}
