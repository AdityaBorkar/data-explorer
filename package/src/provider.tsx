import type { UseQueryOptions } from "@tanstack/react-query";
import type { ColumnDef, ReactTable } from "@tanstack/react-table";
import { useTable } from "@tanstack/react-table";
import { useMemo } from "react";

import { DataExplorerContext } from "./context.tsx";
import { extractColumnConfigs } from "./extract-column-config.ts";
import { toInitialTableState } from "./features/display-snapshot.ts";
import { TableFeatures } from "./features/index.ts";
import { useDataQuery } from "./hooks/use-data-query.ts";
import { useLoadMore } from "./hooks/use-load-more.ts";
import { useView } from "./hooks/use-view.ts";
import type {
	ContextType,
	ListQueryResult,
	RefineOptions,
	ViewAdapter,
} from "./types.ts";
import type { FilterViewDisplay } from "./views.ts";

export function Provider<TItem extends Record<string, unknown>>({
	children,
	columns,
	defaultDisplay,
	domain,
	getRowId,
	onMove,
	query: queryBuilder,
	viewAdapter,
}: {
	children: React.ReactNode;
	columns: ColumnDef<typeof TableFeatures, TItem>[];
	defaultDisplay: FilterViewDisplay;
	domain: string;
	getRowId: (row: TItem) => string;
	onMove?: (args: {
		itemId: string;
		fromGroup: string;
		toGroup: string;
		columnId: string;
	}) => void;
	query: (opts: RefineOptions) => UseQueryOptions<ListQueryResult<TItem>>;
	viewAdapter?: ViewAdapter;
}) {
	const columnsConfig = useMemo(() => extractColumnConfigs(columns), [columns]);
	const initialState = useMemo(
		() => ({
			...toInitialTableState(defaultDisplay, columnsConfig),
			dataFilters: [],
		}),
		[defaultDisplay, columnsConfig],
	);

	const table = useTable({
		columns,
		data: [],
		enableGrouping: true,
		enableHiding: true,
		enableSorting: true,
		enableSortingRemoval: true,
		features: TableFeatures,
		getRowId,
		initialState,
		manualGrouping: true,
		manualSorting: true,
	});

	const sorting = table.state.sorting;
	const grouping = table.state.grouping;
	const columnVisibility = table.state.columnVisibility;
	const columnSizing = table.state.columnSizing;
	const density = table.state.density;
	const viewType = table.state.viewType;
	const dataFilters = table.state.dataFilters ?? [];

	const typedTable = table as unknown as ReactTable<
		typeof TableFeatures,
		Record<string, unknown>
	>;

	const { allItems, query } = useDataQuery({
		columnSizing,
		columnVisibility,
		dataFilters,
		density,
		domain,
		grouping,
		queryBuilder,
		sorting,
		table: typedTable,
		viewType,
	});

	const viewHook = useView({
		columnsConfig,
		defaultDisplay,
		domain,
		table: typedTable,
		viewAdapter,
	});

	const { triggerRef } = useLoadMore(
		query.fetchNextPage,
		query.hasNextPage ?? false,
		query.isFetchingNextPage,
	);

	const contextValue: ContextType = useMemo(
		() => ({
			columnsConfig,
			data: {
				hasMore: query.hasNextPage ?? false,
				isLoading: query.isLoading,
				isLoadingMore: query.isFetchingNextPage,
				items: allItems,
				loadMoreRef: triggerRef,
			},
			onMove,
			table: typedTable,
			view: viewHook,
		}),
		[
			columnsConfig,
			query.hasNextPage,
			query.isLoading,
			query.isFetchingNextPage,
			allItems,
			triggerRef,
			onMove,
			viewHook,
			typedTable,
		],
	);

	return (
		<DataExplorerContext value={contextValue}>{children}</DataExplorerContext>
	);
}
