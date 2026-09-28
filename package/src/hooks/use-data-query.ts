import type {
	QueryFunctionContext,
	UseQueryOptions,
} from "@tanstack/react-query";
import { useInfiniteQuery } from "@tanstack/react-query";
import type {
	ColumnSizingState,
	ColumnVisibilityState,
	GroupingState,
	SortingState,
} from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";

import { DataExplorerError } from "../errors.ts";
import type { FilterCondition } from "../filters.ts";
import {
	type DataQueryKeyRefine,
	dataQueryKey,
	type ListQueryResult,
	type RefineOptions,
} from "../query.ts";
import type { Density, ViewType } from "../views.ts";

// Backwards-compat re-exports for existing deep imports. New code should
// import these from the canonical home (`../query.ts`).
export type { DataQueryKeyRefine } from "../query.ts";
export { dataQueryKey, hashRefine, stableStringify } from "../query.ts";

/**
 * Default page size when `Provider` gets no `pageSize`.
 * Exported for cache-key construction and docs; override per provider.
 */
export const DEFAULT_PAGE_SIZE = 20;

/**
 * Debounced value with a single read path. When `delayMs <= 0` the input
 * is returned directly (no state, nothing stale to leak); otherwise the
 * trailing value commits after the delay.
 */
function useDebouncedValue<T>(value: T, delayMs: number): T {
	const enabled = delayMs > 0;
	const [debounced, setDebounced] = useState(value);
	useEffect(() => {
		if (!enabled) return;
		const t = setTimeout(() => setDebounced(value), delayMs);
		return () => clearTimeout(t);
	}, [value, delayMs, enabled]);
	return enabled ? debounced : value;
}

/**
 * Stable empty-array singleton so render-phase syncs never loop.
 * @internal
 */
const EMPTY_ITEMS: never[] = [];

/**
 * Infinite data query for the explorer table. The stable hashed key
 * (`dataQueryKey`) covers the data-affecting refine slices (filters,
 * sorting, grouping). Display-only state (`columnSizing`,
 * `columnVisibility`, `density`, `viewType`) is passed through to the
 * `queryBuilder` at fetch time for contextual queries, but display-only
 * changes alone never invalidate the cache — the builder sees the display
 * values from the render that triggered the fetch. `pageSize` sets the
 * fetch limit and `debounceFiltersMs` keeps filter keystrokes from
 * refetching per character. Returns `allItems` memoized on `[query.data]`.
 *
 * @example
 * ```tsx
 * const { allItems, query } = useDataQuery({
 *   domain, sorting, grouping, dataFilters, queryBuilder,
 * });
 * ```
 */
export function useDataQuery<TItem extends Record<string, unknown>>(opts: {
	columnSizing: ColumnSizingState;
	columnVisibility: ColumnVisibilityState;
	dataFilters: FilterCondition[];
	density: Density;
	domain: string;
	grouping: GroupingState;
	queryBuilder: (
		opts: RefineOptions,
	) => UseQueryOptions<ListQueryResult<TItem>>;
	sorting: SortingState;
	viewType: ViewType;
	/** @default DEFAULT_PAGE_SIZE */
	pageSize?: number;
	/** Forwarded to TanStack as `staleTime`. */
	staleTime?: number;
	/** Debounce for filter keystrokes before they enter the query key. @default 0 (off) */
	debounceFiltersMs?: number;
}) {
	const {
		columnSizing,
		columnVisibility,
		dataFilters,
		density,
		domain,
		grouping,
		queryBuilder,
		sorting,
		viewType,
		pageSize = DEFAULT_PAGE_SIZE,
		staleTime,
		debounceFiltersMs = 0,
	} = opts;

	// Debounce filter typing so each keystroke does not mint a new query key.
	const effectiveFilters = useDebouncedValue(dataFilters, debounceFiltersMs);

	const keyRefine: DataQueryKeyRefine = useMemo(
		() => ({
			dataFilters: effectiveFilters,
			grouping,
			sorting,
		}),
		[effectiveFilters, grouping, sorting],
	);

	// Hoisted so `queryKey` and the fetch below always share one reference
	// instead of hashing the refine slices twice per page.
	const queryKey = useMemo(
		() => dataQueryKey(domain, keyRefine),
		[domain, keyRefine],
	);

	const query = useInfiniteQuery({
		getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
		initialPageParam: undefined as string | undefined,
		queryFn: ({
			pageParam,
			signal,
		}: QueryFunctionContext<readonly unknown[], string | undefined>) => {
			const firstSort = sorting[0];
			const built = queryBuilder({
				columnSizing,
				columnVisibility,
				cursor: pageParam,
				density,
				filters: effectiveFilters,
				grouping,
				limit: pageSize,
				orderBy: {
					columnId: firstSort?.id ?? "",
					direction: firstSort?.desc ? "desc" : "asc",
				},
				sorting,
				viewType,
			});
			// Fail fast on the builder contract before any network work.
			// The wrapper owns the cache key (`queryKey` above): the
			// builder's `queryKey` is still required by the contract (standalone
			// use, devtools display) but the fetch always runs under the outer
			// key so cache and network never diverge.
			if (typeof built.queryFn !== "function" || !built.queryKey) {
				throw new DataExplorerError(
					"INVALID_QUERY_OPTIONS",
					"query() must return { queryKey, queryFn }.",
				);
			}
			return built.queryFn({
				queryKey,
				signal,
			} as QueryFunctionContext) as Promise<ListQueryResult<TItem>>;
		},
		queryKey,
		staleTime,
	});
	const allItems = useMemo(
		() => query.data?.pages.flatMap((p) => p.items) ?? EMPTY_ITEMS,
		[query.data],
	);

	return { allItems, query };
}
