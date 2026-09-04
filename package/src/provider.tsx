import type { UseQueryOptions } from "@tanstack/react-query";
import { QueryClientContext } from "@tanstack/react-query";
import type { ColumnDef, ReactTable } from "@tanstack/react-table";
import { useTable } from "@tanstack/react-table";
import { useContext, useMemo, useRef, useState } from "react";

import type { ExtractColumnConfigOptions } from "./columns.ts";
import { DataExplorerContext } from "./context.tsx";
import { DataExplorerError } from "./errors.ts";
import { extractColumnConfigs } from "./extract-column-config.ts";
import { toInitialTableState } from "./features/display-snapshot.ts";
import { TableFeatures } from "./features/index.ts";
import { useDataQuery } from "./hooks/use-data-query.ts";
import { useLoadMore } from "./hooks/use-load-more.ts";
import { useView } from "./hooks/use-view.ts";
import type {
	BoardMoveHandler,
	ContextType,
	DataExplorerContextValue,
	ListQueryResult,
	RefineOptions,
	ViewAdapter,
} from "./types.ts";
import type { FilterViewDisplay } from "./views.ts";

/** Props for {@link Provider}. */
export interface DataExplorerProviderProps<
	TItem extends Record<string, unknown>,
> {
	children: React.ReactNode;
	/** Memoize in the consumer — only id changes recompute `columnsConfig`. */
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
	onMove?: BoardMoveHandler;
	/** Rows per page. @default DEFAULT_PAGE_SIZE (20) */
	pageSize?: number;
	query: (opts: RefineOptions) => UseQueryOptions<ListQueryResult<TItem>>;
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
 * Data flows declaratively — fetched pages sync into `useTable({ data })`
 * via a render-phase state update (concurrent-safe; no `table.options`
 * mutation). Requires a `QueryClientProvider` ancestor.
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

	// Shallow id-join memo: inline `columns` arrays don't recompute configs;
	// a changed id set does. Meta-only edits require a memoized `columns`
	// prop or an id change — documented, not silently recomputed per render.
	const columnIds = columns.map((c) => c.id ?? "").join("");
	// biome-ignore lint/correctness/useExhaustiveDependencies: id-join memo by design
	const columnsConfig = useMemo(
		() =>
			extractColumnConfigs(columns, {
				...(onInvalidColumn !== undefined ? { onInvalidColumn } : {}),
				...(strictColumns !== undefined ? { strict: strictColumns } : {}),
			}),
		[columnIds, onInvalidColumn, strictColumns],
	);
	const initialState = useMemo(
		() => ({
			...toInitialTableState(defaultDisplay, columnsConfig),
			dataFilters: [],
		}),
		[defaultDisplay, columnsConfig],
	);

	// Explicit uncontrolled contract: freeze after mount, dev-warn on change.
	const frozenInitialStateRef = useRef(initialState);
	const mountedDisplayRef = useRef(defaultDisplay);
	if (
		process.env.NODE_ENV !== "production" &&
		mountedDisplayRef.current !== defaultDisplay
	) {
		console.warn(
			"[data-explorer] Provider defaultDisplay changes after mount are ignored (uncontrolled). Apply updates via applyDisplaySnapshot/table APIs, or key the Provider by domain for a hard reset.",
		);
		mountedDisplayRef.current = defaultDisplay;
	}

	// Declarative data feed: render-phase sync (concurrent-safe) replaces the
	// old `table.options.data = …` post-hoc mutation. `allItems` is memoized
	// on `[query.data]` with a stable empty singleton, so this only fires a
	// same-commit re-render when fresh pages actually arrive.
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
		initialState: frozenInitialStateRef.current,
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

	const typedTable = useMemo(
		() => table as unknown as ReactTable<typeof TableFeatures, TItem>,
		[table],
	);

	const { allItems, query } = useDataQuery({
		columnSizing,
		columnVisibility,
		dataFilters,
		debounceFiltersMs,
		density,
		domain,
		grouping,
		pageSize,
		queryBuilder,
		sorting,
		staleTime,
		viewType,
	});

	if (tableData !== allItems) setTableData(allItems);

	const viewHook = useView({
		columnsConfig,
		defaultDisplay,
		domain,
		table: typedTable as unknown as ReactTable<
			typeof TableFeatures,
			Record<string, unknown>
		>,
		viewAdapter,
	});

	const { triggerRef } = useLoadMore(
		query.fetchNextPage,
		query.hasNextPage ?? false,
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
		resetToDefault,
		resetToSaved,
		saveView,
		saveViewAs,
		views,
	} = viewHook;

	const hasNextPage = query.hasNextPage ?? false;
	const isLoading = query.isLoading;
	const isFetchingNextPage = query.isFetchingNextPage;

	const contextValue: DataExplorerContextValue<TItem> = useMemo(
		() => ({
			columnsConfig,
			data: {
				hasMore: hasNextPage,
				isLoading,
				isLoadingMore: isFetchingNextPage,
				items: allItems,
				loadMoreRef: triggerRef,
			},
			...(onMove !== undefined ? { onMove } : {}),
			table: typedTable,
			view: {
				...(activeView !== undefined ? { activeView } : {}),
				activeViewId,
				applyView,
				createView,
				deleteView,
				error: viewError,
				isLoading: viewsLoading,
				renameView,
				resetToDefault,
				resetToSaved,
				saveView,
				saveViewAs,
				...(views !== undefined ? { views } : {}),
			},
		}),
		[
			columnsConfig,
			hasNextPage,
			isLoading,
			isFetchingNextPage,
			allItems,
			triggerRef,
			onMove,
			typedTable,
			activeView,
			activeViewId,
			applyView,
			createView,
			deleteView,
			viewError,
			viewsLoading,
			renameView,
			resetToDefault,
			resetToSaved,
			saveView,
			saveViewAs,
			views,
		],
	);

	// Back-compat: `ContextType` is an alias of `DataExplorerContextValue`.
	const legacyValue = contextValue as unknown as ContextType;

	return (
		<DataExplorerContext value={legacyValue}>{children}</DataExplorerContext>
	);
}
