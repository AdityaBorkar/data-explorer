import type {
	QueryFunctionContext,
	UseQueryOptions,
} from "@tanstack/react-query";
import { useInfiniteQuery } from "@tanstack/react-query";
import type {
	ColumnSizingState,
	ColumnVisibilityState,
	GroupingState,
	ReactTable,
	SortingState,
} from "@tanstack/react-table";
import { useMemo } from "react";

import type { FilterCondition } from "../filters.ts";
import type { ListQueryResult, RefineOptions } from "../query.ts";
import type { TableFeatures } from "../types.ts";
import type { Density, ViewType } from "../views.ts";

export const PAGE_SIZE = 20;

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
	table: ReactTable<TableFeatures, Record<string, unknown>>;
	viewType: ViewType;
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
		table,
		viewType,
	} = opts;

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
				filters: dataFilters,
				grouping,
				limit: PAGE_SIZE,
				orderBy: {
					columnId: firstSort?.id ?? "",
					direction: firstSort?.desc ? "desc" : "asc",
				},
				sorting,
				viewType,
			});
			if (typeof built.queryFn !== "function") {
				throw new Error("buildQueryOptions must return a queryFn");
			}
			return built.queryFn({
				queryKey: built.queryKey,
				signal,
			} as QueryFunctionContext) as Promise<ListQueryResult<TItem>>;
		},
		queryKey: [
			"data-explorer",
			domain,
			{
				columnSizing,
				columnVisibility,
				conditions: dataFilters,
				density,
				grouping,
				sorting,
				viewType,
			},
		],
	});
	const allItems = useMemo(
		() => query.data?.pages.flatMap((p) => p.items) ?? [],
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[query.data],
	);
	// Feed fresh pages directly into the table without a lagged useState copy.
	(table.options as unknown as { data: TItem[] }).data = allItems;

	return { allItems, query };
}
