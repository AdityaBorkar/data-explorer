import type { UseQueryOptions } from "@tanstack/react-query";
import { QueryClientContext } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useTable } from "@tanstack/react-table";
import {
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

import type { ExtractColumnConfigOptions } from "./columns.ts";
import { extractColumnConfigs } from "./columns.ts";
import { DataExplorerContext } from "./context.tsx";
import { DataExplorerError } from "./errors.ts";
import { toInitialTableState } from "./features/display-snapshot.ts";
import { TableFeatures } from "./features/index.ts";
import { useDataQuery } from "./hooks/use-data-query.ts";
import { useLoadMore } from "./hooks/use-load-more.ts";
import { useView } from "./hooks/use-view.ts";
import type { DataRefineOptions, ListQueryResult } from "./query.ts";
import type { BoardMoveHandler, DataExplorerContextValue } from "./types.ts";
import type { FilterViewDisplay, ViewAdapter } from "./views.ts";

/** Props for {@link Provider}. */
export interface DataExplorerProviderProps<
	TItem extends Record<string, unknown>,
> {
	children: React.ReactNode;
	/** Memoize in the consumer to avoid recomputing `columnsConfig` per render. */
	columns: ColumnDef<typeof TableFeatures, TItem>[];
	/** Debounce for filter keystrokes before they enter the query key. @default 0 (off) */
	debounceFiltersMs?: number;
	/**
	 * Applied once as table `initialState` (uncontrolled). Changes after
	 * mount are ignored — apply updates via `applyDisplaySnapshot`/table
	 * APIs, or key the provider (`<Provider key={domain}>`) for a hard reset.
	 */
	defaultDisplay: FilterViewDisplay;
	domain: string;
	getRowId: (row: TItem) => string;
	/** Called once per skipped column definition (library never logs). */
	onInvalidColumn?: ExtractColumnConfigOptions["onInvalidColumn"];
	/** Board card moves. Held in a ref — inlining the handler won't re-render consumers. */
	onMove?: BoardMoveHandler;
	/** Rows per page. @default DEFAULT_PAGE_SIZE (20) */
	pageSize?: number;
	query: (opts: DataRefineOptions) => UseQueryOptions<ListQueryResult<TItem>>;
	/** Forwarded to TanStack as `staleTime`. */
	staleTime?: number;
	/** Fail fast on invalid column definitions. */
	strictColumns?: boolean;
	viewAdapter?: ViewAdapter;
}

/** Throw an actionable error when no `QueryClientProvider` ancestor exists. */
function useQueryClientGuard(): void {
	const client = useContext(QueryClientContext);
	if (!client) {
		throw new DataExplorerError(
			"MISSING_QUERY_CLIENT",
			"Wrap <Provider> in <QueryClientProvider>.",
		);
	}
}

/**
 * Headless data-explorer provider: owns the single TanStack table instance,
 * the infinite data query, and persisted-view state.
 *
 * Data flows `table.state → query → allItems → tableData → table.data`.
 * The `tableData` state + effect hop breaks the hook-order cycle (`useTable`
 * needs data that `useDataQuery` computes from `table.state`), with no
 * render-phase `setState` and no `table.options` mutation. Context consumers
 * read the same `tableData` reference the table sees. Requires a
 * `QueryClientProvider` ancestor.
 *
 * @example
 * ```tsx
 * <QueryClientProvider client={client}>
 *   <Provider columns={cols} defaultDisplay={DEFAULT_DISPLAY} domain="tasks"
 *     getRowId={(r) => r.id} query={createMemoryQuery(TASKS)}>
 *     <FilterBar />
 *   </Provider>
 * </QueryClientProvider>
 * ```
 */
export function Provider<TItem extends Record<string, unknown>>({
	children,
	columns,
	defaultDisplay,
	domain,
	getRowId,
	onMove,
	query: queryBuilder,
	viewAdapter,
	pageSize,
	staleTime,
	debounceFiltersMs,
	onInvalidColumn,
	strictColumns,
}: DataExplorerProviderProps<TItem>) {
	useQueryClientGuard();

	// Latest `onMove` rides a ref so the context value stays stable when a
	// consumer inlines the handler. Presence (`undefined` vs defined) is
	// still derived from the prop, so board drop-targets keep working.
	const onMoveRef = useRef(onMove);
	useEffect(() => {
		onMoveRef.current = onMove;
	}, [onMove]);
	const handleMove = useCallback(
		(...args: Parameters<NonNullable<typeof onMove>>) =>
			onMoveRef.current?.(...args),
		[],
	);
	const stableOnMove = onMove ? handleMove : undefined;

	const columnsConfig = useMemo(
		() =>
			extractColumnConfigs(columns, {
				onInvalidColumn,
				strict: strictColumns,
			}),
		[columns, onInvalidColumn, strictColumns],
	);

	// Uncontrolled by design: frozen on first render via lazy `useState`.
	const [frozenInitialState] = useState(() => ({
		...toInitialTableState(defaultDisplay, columnsConfig),
		dataFilters: [],
	}));

	// The `table.state → query → data → table` hook-order cycle is broken
	// by this state + effect hop: the table reads `tableData`, the query
	// reads `table.state`, and fresh pages land here one commit later.
	// `allItems` is stable (empty singleton until pages arrive), so this
	// only re-renders when fresh pages land. `context.items` reads the
	// same `tableData` reference below, so consumers never observe rows
	// the table instance doesn't know about yet.
	const [tableData, setTableData] = useState<TItem[]>([]);

	const table = useTable({
		autoResetAll: false,
		columns,
		data: tableData,
		enableGrouping: true,
		enableHiding: true,
		enableSorting: true,
		enableSortingRemoval: true,
		features: TableFeatures,
		getRowId,
		initialState: frozenInitialState,
		manualGrouping: true,
		manualSorting: true,
	});

	const sorting = table.state.sorting;
	const grouping = table.state.grouping;
	const dataFilters = table.state.dataFilters ?? [];

	const { allItems, query } = useDataQuery<TItem>({
		dataFilters,
		debounceFiltersMs,
		domain,
		grouping,
		pageSize,
		queryBuilder,
		sorting,
		staleTime,
	});

	useEffect(() => {
		setTableData(allItems);
	}, [allItems]);

	const viewHook = useView<TItem>({
		columnsConfig,
		defaultDisplay,
		domain,
		table,
		viewAdapter,
	});

	const { triggerRef } = useLoadMore(
		query.fetchNextPage,
		query.hasNextPage,
		query.isFetchingNextPage,
	);

	// Destructure so memo deps are primitives + stable callbacks — not the
	// `viewHook` object identity (which would re-render every consumer).
	const {
		activeView,
		activeViewId,
		applyView,
		createView,
		deleteView,
		error: viewError,
		isLoading: viewsLoading,
		renameView,
		resetToSaved,
		saveView,
		views,
	} = viewHook;

	const hasNextPage = query.hasNextPage;
	const isLoading = query.isLoading;
	const isFetchingNextPage = query.isFetchingNextPage;

	const contextValue: DataExplorerContextValue<TItem> = useMemo(
		() => ({
			columnsConfig,
			data: {
				hasMore: hasNextPage,
				isLoading,
				isLoadingMore: isFetchingNextPage,
				items: tableData,
				loadMoreRef: triggerRef,
			},
			onMove: stableOnMove,
			table,
			view: {
				activeView,
				activeViewId,
				applyView,
				createView,
				deleteView,
				error: viewError,
				isLoading: viewsLoading,
				renameView,
				resetToSaved,
				saveView,
				views,
			},
		}),
		[
			columnsConfig,
			hasNextPage,
			isLoading,
			isFetchingNextPage,
			tableData,
			triggerRef,
			stableOnMove,
			table,
			activeView,
			activeViewId,
			applyView,
			createView,
			deleteView,
			viewError,
			viewsLoading,
			renameView,
			resetToSaved,
			saveView,
			views,
		],
	);

	return (
		<DataExplorerContext
			value={
				// The context is intentionally non-generic (one shared
				// instance); the cast restores the row type at consumption.
				contextValue as unknown as DataExplorerContextValue<
					Record<string, unknown>
				>
			}
		>
			{children}
		</DataExplorerContext>
	);
}
