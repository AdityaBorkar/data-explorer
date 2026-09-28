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
import { stableStringify } from "../features/data-filtering/filter-merge.ts";
import type { FilterCondition } from "../filters.ts";
import type { ListQueryResult, RefineOptions } from "../query.ts";
import type { Density, ViewType } from "../views.ts";

/**
 * Default page size when `Provider` gets no `pageSize`.
 * Exported for cache-key construction and docs; override per provider.
 */
export const DEFAULT_PAGE_SIZE = 20;

/**
 * @deprecated Use {@link DEFAULT_PAGE_SIZE}. Kept as an alias for one minor.
 */
export const PAGE_SIZE = DEFAULT_PAGE_SIZE;

/** Refine slice that participates in the data query key: only the slices the fetcher filters/sorts/groups by. Display-only state (`columnSizing`, `columnVisibility`, `density`, `viewType`) is passed to the `queryBuilder` but deliberately excluded so resizing columns or toggling density never busts the data cache. */
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

/**
 * Stable empty-array singleton so render-phase syncs never loop.
 * @internal
 */
const EMPTY_ITEMS: never[] = [];

/**
 * Infinite data query for the explorer table. The stable hashed key
 * (`dataQueryKey`) covers the data-affecting refine slices (filters,
 * sorting, grouping); display-only state still reaches the `queryBuilder`
 * but never busts the cache. `pageSize` sets the fetch limit and
 * `debounceFiltersMs` keeps filter keystrokes from refetching per
 * character. Returns `allItems` memoized on `[query.data]`.
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
	// When debouncing is off there is no intermediate state to sync —
	// `effectiveFilters` reads `dataFilters` directly.
	const [debouncedFilters, setDebouncedFilters] =
		useState<FilterCondition[]>(dataFilters);
	useEffect(() => {
		if (debounceFiltersMs <= 0) return;
		const t = setTimeout(
			() => setDebouncedFilters(dataFilters),
			debounceFiltersMs,
		);
		return () => clearTimeout(t);
	}, [dataFilters, debounceFiltersMs]);
	const effectiveFilters =
		debounceFiltersMs <= 0 ? dataFilters : debouncedFilters;

	const keyRefine: DataQueryKeyRefine = useMemo(
		() => ({
			dataFilters: effectiveFilters,
			grouping,
			sorting,
		}),
		[effectiveFilters, grouping, sorting],
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
			if (typeof built.queryFn !== "function" || !built.queryKey) {
				throw new DataExplorerError(
					"INVALID_QUERY_OPTIONS",
					"query() must return { queryKey, queryFn }.",
				);
			}
			// Honor the builder's key when present; otherwise fall back to the
			// stable outer key so structurally identical refines share cache.
			const queryKey = built.queryKey ?? dataQueryKey(domain, keyRefine);
			return built.queryFn({
				queryKey,
				signal,
			} as QueryFunctionContext) as Promise<ListQueryResult<TItem>>;
		},
		queryKey: dataQueryKey(domain, keyRefine),
		staleTime,
	});
	const allItems = useMemo(
		() => query.data?.pages.flatMap((p) => p.items) ?? EMPTY_ITEMS,
		[query.data],
	);

	return { allItems, query };
}
