import type {
  QueryFunctionContext,
  UseQueryOptions,
} from "@tanstack/react-query";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import {
  CallbackContext,
  ConfigContext,
  DataContext,
  DisplayContext,
  FilterContext,
  SelectionContext,
  ViewContext,
} from "./context";
import { useDisplay } from "./hooks/use-display";
import { useFilters } from "./hooks/use-filters";
import { useLoadMore } from "./hooks/use-load-more";
import { useSelection } from "./hooks/use-selection";
import { useView } from "./hooks/use-view";
import type {
  ColumnConfig,
  FilterViewDisplay,
  ListQueryResult,
  RefineOptions,
} from "./types";
import type { ViewAdapter } from "./view-adapter";

const PAGE_SIZE = 20;

export function Provider<TItem>({
  children,
  columnsConfig: columnsConfigProp,
  defaultDisplay,
  domain,
  getRowId,
  onMove,
  query: queryBuilder,
  viewAdapter,
}: {
  children: React.ReactNode;
  columnsConfig: ColumnConfig[];
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
  const displayHook = useDisplay({
    columnsConfig: columnsConfigProp,
    defaultDisplay,
  });
  const filtersHook = useFilters();
  const selection = useSelection();
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

  const selectAll = useCallback(() => {
    selection.setSelectedRowIds(new Set(derivedAllRowIds));
  }, [derivedAllRowIds, selection.setSelectedRowIds]);

  const { triggerRef } = useLoadMore(
    query.fetchNextPage,
    query.hasNextPage ?? false,
    query.isFetchingNextPage,
  );

  const configValue = useMemo(
    () => ({ columnsConfig: columnsConfigProp }),
    [columnsConfigProp],
  );

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
                  {children}
                </CallbackContext>
              </ViewContext>
            </DataContext>
          </SelectionContext>
        </DisplayContext>
      </FilterContext>
    </ConfigContext>
  );
}
