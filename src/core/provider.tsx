import type {
  QueryFunctionContext,
  UseQueryOptions,
} from "@tanstack/react-query";
import { useInfiniteQuery } from "@tanstack/react-query";
import type {
  ColumnDef,
  ColumnVisibilityState,
  GroupingState,
  ReactTable,
  SortingState,
} from "@tanstack/react-table";
import { useTable } from "@tanstack/react-table";
import { useMemo, useState } from "react";

import { DataExplorerContext } from "./context.tsx";
import { extractColumnConfigs } from "./features/extract-column-config.ts";
import { dataExplorerTableFeatures } from "./features/index.ts";
import { useLoadMore } from "./hooks/use-load-more.ts";
import { useView } from "./hooks/use-view.ts";
import type {
  ColumnConfig,
  ContextType,
  Density,
  FilterViewDisplay,
  ListQueryResult,
  RefineOptions,
  ViewAdapter,
  ViewType,
} from "./types.ts";

const PAGE_SIZE = 20;

function toInitialSorting(display: FilterViewDisplay): SortingState {
  return display.orderBy
    ? [{ desc: display.orderType === "desc", id: display.orderBy }]
    : [];
}

function toInitialColumnVisibility(
  display: FilterViewDisplay,
  columnsConfig: ColumnConfig[],
): ColumnVisibilityState {
  const state: ColumnVisibilityState = {};
  for (const col of columnsConfig) {
    state[col.id] = display.fields.includes(col.id);
  }
  return state;
}

function toInitialGrouping(display: FilterViewDisplay): GroupingState {
  return display.groupBy ? [display.groupBy] : [];
}

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
  columns: ColumnDef<typeof dataExplorerTableFeatures, TItem>[];
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

  const [density, setDensity] = useState<Density>(defaultDisplay.density);
  const [viewType, setViewType] = useState<ViewType>(defaultDisplay.type);
  const [data, setData] = useState<TItem[]>([]);

  const table = useTable({
    columns,
    data,
    enableGrouping: true,
    enableHiding: true,
    enableSorting: true,
    enableSortingRemoval: true,
    features: dataExplorerTableFeatures,
    getRowId: (row) => getRowId(row as TItem),
    initialState: {
      columnSizing: defaultDisplay.columnWidths,
      columnVisibility: toInitialColumnVisibility(
        defaultDisplay,
        columnsConfig,
      ),
      dataFilters: [],
      grouping: toInitialGrouping(defaultDisplay),
      sorting: toInitialSorting(defaultDisplay),
    },
    manualGrouping: true,
    manualSorting: true,
  });

  const orderBy = useMemo(
    () => ({
      columnId: table.state.sorting[0]?.id ?? "",
      direction: (table.state.sorting[0]?.desc ? "desc" : "asc") as
        | "asc"
        | "desc",
    }),
    [table.state.sorting],
  );

  const query = useInfiniteQuery({
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: undefined as string | undefined,
    queryFn: ({
      pageParam,
      signal,
    }: QueryFunctionContext<readonly unknown[], string | undefined>) => {
      const opts = queryBuilder({
        columnSizing: table.state.columnSizing,
        columnVisibility: table.state.columnVisibility,
        cursor: pageParam,
        density,
        filters: table.state.dataFilters ?? [],
        grouping: table.state.grouping,
        limit: PAGE_SIZE,
        orderBy,
        sorting: table.state.sorting,
        viewType,
      });
      if (typeof opts.queryFn !== "function") {
        throw new Error("buildQueryOptions must return a queryFn");
      }
      return opts.queryFn({
        queryKey: opts.queryKey,
        signal,
      } as QueryFunctionContext) as Promise<ListQueryResult<TItem>>;
    },
    queryKey: [
      "data-explorer",
      domain,
      {
        columnVisibility: table.state.columnVisibility,
        conditions: table.state.dataFilters ?? [],
        density,
        grouping: table.state.grouping,
        orderBy,
        sorting: table.state.sorting,
        viewType,
      },
    ],
  });

  const allItems = useMemo(
    () => query.data?.pages.flatMap((p) => p.items) ?? [],
    [query.data?.pages],
  );
  if (allItems !== data) {
    setData(allItems);
  }

  const viewHook = useView({
    columnsConfig,
    defaultDisplay,
    density,
    domain,
    setDensity,
    setViewType,
    table: table as unknown as ReactTable<
      typeof dataExplorerTableFeatures,
      Record<string, unknown>
    >,
    viewAdapter,
    viewType,
  });

  const { triggerRef } = useLoadMore(
    query.fetchNextPage,
    query.hasNextPage ?? false,
    query.isFetchingNextPage,
  );

  const contextValue = useMemo(
    () =>
      ({
        columnsConfig,
        data: {
          hasMore: query.hasNextPage ?? false,
          isLoading: query.isLoading,
          isLoadingMore: query.isFetchingNextPage,
          items: allItems,
          loadMoreRef: triggerRef,
        },
        density,
        onMove,
        setDensity,
        setViewType,
        table: table as unknown as ReactTable<
          typeof dataExplorerTableFeatures,
          Record<string, unknown>
        >,
        view: viewHook,
        viewType,
      }) as unknown as ContextType,
    [
      columnsConfig,
      query.hasNextPage,
      query.isLoading,
      query.isFetchingNextPage,
      allItems,
      triggerRef,
      density,
      onMove,
      viewType,
      viewHook,
      table,
    ],
  );

  return (
    <DataExplorerContext value={contextValue}>{children}</DataExplorerContext>
  );
}
