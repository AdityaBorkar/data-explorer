import type {
  QueryFunctionContext,
  UseQueryOptions,
} from "@tanstack/react-query";
import { useInfiniteQuery } from "@tanstack/react-query";
import type {
  ColumnDef,
  ColumnVisibilityState,
  GroupingState,
  SortingState,
  Updater,
} from "@tanstack/react-table";
import { useTable } from "@tanstack/react-table";
import { useCallback, useMemo } from "react";

import { extractColumnConfigs } from "./column-utils.ts";
import {
  CallbackContext,
  ConfigContext,
  DataContext,
  DisplayContext,
  FilterContext,
  SelectionContext,
  TableContext,
  ViewContext,
} from "./context.tsx";
import { dataExplorerTableFeatures } from "./features/index.ts";
import { useDisplay } from "./hooks/use-display.ts";
import { useFilters } from "./hooks/use-filters.ts";
import { useLoadMore } from "./hooks/use-load-more.ts";
import { useSelection } from "./hooks/use-selection.ts";
import { useView } from "./hooks/use-view.ts";
import type {
  ColumnConfig,
  FilterViewDisplay,
  ListQueryResult,
  RefineOptions,
  TableContextType,
} from "./types.ts";
import type { ViewAdapter } from "./view-adapter.ts";

const PAGE_SIZE = 20;

/** Apply a TanStack `Updater<T>` (value or function) to a current value. */
function resolveUpdater<T>(updater: Updater<T>, current: T): T {
  return typeof updater === "function"
    ? (updater as (old: T) => T)(current)
    : updater;
}

function toSortingState(display: FilterViewDisplay): SortingState {
  return display.orderBy
    ? [{ desc: display.orderType === "desc", id: display.orderBy }]
    : [];
}

function fromSortingChange(
  updater: Updater<SortingState>,
  prev: FilterViewDisplay,
): Partial<FilterViewDisplay> {
  const next = resolveUpdater(updater, toSortingState(prev));
  const first = next[0];
  if (!first) return { orderBy: "", orderType: "asc" };
  return { orderBy: first.id, orderType: first.desc ? "desc" : "asc" };
}

function toColumnVisibilityState(
  display: FilterViewDisplay,
  columnsConfig: ColumnConfig[],
): ColumnVisibilityState {
  const state: ColumnVisibilityState = {};
  for (const col of columnsConfig) {
    state[col.id] = display.fields.includes(col.id);
  }
  return state;
}

function fromColumnVisibilityChange(
  updater: Updater<ColumnVisibilityState>,
  prev: FilterViewDisplay,
  columnsConfig: ColumnConfig[],
): Partial<FilterViewDisplay> {
  const next = resolveUpdater(
    updater,
    toColumnVisibilityState(prev, columnsConfig),
  );
  return {
    fields: columnsConfig.filter((c) => next[c.id] !== false).map((c) => c.id),
  };
}

function toGroupingState(display: FilterViewDisplay): GroupingState {
  return display.groupBy ? [display.groupBy] : [];
}

function fromGroupingChange(
  updater: Updater<GroupingState>,
  prev: FilterViewDisplay,
): Partial<FilterViewDisplay> {
  const next = resolveUpdater(updater, toGroupingState(prev));
  return { groupBy: next[0] ?? null };
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

  const displayHook = useDisplay({
    columnsConfig,
    defaultDisplay,
  });
  const filtersHook = useFilters();
  const viewHook = useView({
    defaultDisplay,
    display: displayHook.display,
    domain,
    filterConditions: filtersHook.filterConditions,
    setDisplay: displayHook.setDisplay,
    setFilters: filtersHook.setFilters,
    viewAdapter,
  });

  const orderBy = useMemo(
    () => ({
      columnId: displayHook.display.orderBy,
      direction: displayHook.display.orderType,
    }),
    [displayHook.display.orderBy, displayHook.display.orderType],
  );

  const query = useInfiniteQuery({
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: undefined as string | undefined,
    queryFn: ({
      pageParam,
      signal,
    }: QueryFunctionContext<readonly unknown[], string | undefined>) => {
      const opts = queryBuilder({
        cursor: pageParam,
        display: displayHook.display,
        filters: filtersHook.filterConditions,
        limit: PAGE_SIZE,
        orderBy,
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
        conditions: filtersHook.filterConditions,
        display: displayHook.display,
        orderBy,
      },
    ],
  });

  const allItems = useMemo(
    () => query.data?.pages.flatMap((p) => p.items) ?? [],
    [query.data?.pages],
  );

  const derivedAllRowIds = useMemo(
    () => allItems.map((item) => getRowId(item as TItem)),
    [allItems, getRowId],
  );

  const table = useTable({
    columns,
    data: allItems,
    enableGrouping: true,
    enableHiding: true,
    enableSorting: true,
    enableSortingRemoval: true,
    features: dataExplorerTableFeatures,
    getRowId: (row) => getRowId(row as TItem),
    manualGrouping: true,
    manualSorting: true,
    onColumnSizingChange: (updater) =>
      displayHook.setDisplay((prev) => ({
        ...prev,
        columnWidths: resolveUpdater(updater, prev.columnWidths),
      })),
    onColumnVisibilityChange: (updater) =>
      displayHook.setDisplay((prev) => ({
        ...prev,
        ...fromColumnVisibilityChange(updater, prev, columnsConfig),
      })),
    onGroupingChange: (updater) =>
      displayHook.setDisplay((prev) => ({
        ...prev,
        ...fromGroupingChange(updater, prev),
      })),
    onSortingChange: (updater) =>
      displayHook.setDisplay((prev) => ({
        ...prev,
        ...fromSortingChange(updater, prev),
      })),
    state: {
      columnSizing: displayHook.display.columnWidths,
      columnVisibility: toColumnVisibilityState(
        displayHook.display,
        columnsConfig,
      ),
      grouping: toGroupingState(displayHook.display),
      sorting: toSortingState(displayHook.display),
    },
  });

  const selection = useSelection({ table });

  const selectAll = useCallback(
    () => table.toggleAllRowsSelected(true),
    [table],
  );

  const { triggerRef } = useLoadMore(
    query.fetchNextPage,
    query.hasNextPage ?? false,
    query.isFetchingNextPage,
  );

  const configValue = useMemo(() => ({ columnsConfig }), [columnsConfig]);

  const filterValue = useMemo(
    () => ({
      addFilter: filtersHook.addFilter,
      clearFilters: filtersHook.clearFilters,
      filterConditions: filtersHook.filterConditions,
      removeFilter: filtersHook.removeFilter,
      setFilters: filtersHook.setFilters,
      updateFilter: filtersHook.updateFilter,
    }),
    [filtersHook],
  );

  const displayValue = useMemo(
    () => ({
      display: displayHook.display,
      updateDisplay: displayHook.updateDisplay,
    }),
    [displayHook.display, displayHook.updateDisplay],
  );

  const selectionValue = useMemo(
    () => ({
      allRowIds: derivedAllRowIds,
      clearSelection: selection.clearSelection,
      selectAll,
      selectedRowIds: selection.selectedRowIds,
      toggleRowSelection: selection.toggleRowSelection,
    }),
    [
      derivedAllRowIds,
      selection.clearSelection,
      selectAll,
      selection.selectedRowIds,
      selection.toggleRowSelection,
    ],
  );

  const dataValue = useMemo(
    () => ({
      hasMore: query.hasNextPage ?? false,
      isLoading: query.isLoading,
      isLoadingMore: query.isFetchingNextPage,
      items: allItems,
      loadMoreRef: triggerRef,
    }),
    [
      query.hasNextPage,
      query.isLoading,
      query.isFetchingNextPage,
      allItems,
      triggerRef,
    ],
  );

  const viewValue = useMemo(
    () => ({
      activeViewId: viewHook.activeViewId,
      applyView: viewHook.applyView,
      resetToSaved: viewHook.resetToSaved,
      saveView: viewHook.saveView,
    }),
    [
      viewHook.activeViewId,
      viewHook.applyView,
      viewHook.resetToSaved,
      viewHook.saveView,
    ],
  );

  const callbackValue = useMemo(() => ({ onMove }), [onMove]);

  return (
    <ConfigContext value={configValue}>
      <FilterContext value={filterValue}>
        <DisplayContext value={displayValue}>
          <SelectionContext value={selectionValue}>
            <DataContext value={dataValue}>
              <ViewContext value={viewValue}>
                <CallbackContext value={callbackValue}>
                  <TableContext
                    value={{ table } as unknown as TableContextType}
                  >
                    {children}
                  </TableContext>
                </CallbackContext>
              </ViewContext>
            </DataContext>
          </SelectionContext>
        </DisplayContext>
      </FilterContext>
    </ConfigContext>
  );
}
