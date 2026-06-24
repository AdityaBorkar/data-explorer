import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactTable } from "@tanstack/react-table";
import { useCallback, useMemo, useState } from "react";

import { mergeDisplay } from "../features/data-filtering/filter-merge.ts";
import {
  applyDisplaySnapshot,
  toDisplaySnapshot,
} from "../features/display-snapshot.ts";
import type { DataExplorerTableFeatures } from "../features/index.ts";
import type {
  ColumnConfig,
  Density,
  FilterViewDisplay,
  ViewAdapter,
  ViewType,
} from "../types.ts";

export function useView({
  columnsConfig,
  defaultDisplay,
  density,
  domain,
  setDensity,
  setViewType,
  table,
  viewAdapter,
  viewType,
}: {
  columnsConfig: ColumnConfig[];
  defaultDisplay: FilterViewDisplay;
  density: Density;
  domain: string;
  setDensity: (d: Density) => void;
  setViewType: (vt: ViewType) => void;
  table: ReactTable<DataExplorerTableFeatures, Record<string, unknown>>;
  viewAdapter?: ViewAdapter;
  viewType: ViewType;
}) {
  const queryClient = useQueryClient();
  const [activeViewId, setActiveViewId] = useState<string | null>(null);

  const { data: views } = useQuery({
    enabled: !!viewAdapter,
    queryFn: () => viewAdapter?.listViews(domain) ?? [],
    queryKey: ["data-explorer", "views", domain],
  });

  const activeView = useMemo(
    () => views?.find((v) => v.id === activeViewId) ?? null,
    [views, activeViewId],
  );

  const applyView = useCallback(
    (viewId: string | null) => {
      setActiveViewId(viewId);
      if (!(viewId && views)) {
        table.setDataFilters([]);
        applyDisplaySnapshot(
          defaultDisplay,
          table,
          setDensity,
          setViewType,
          columnsConfig,
        );
        return;
      }
      const view = views.find((v) => v.id === viewId);
      if (!view) return;
      table.setDataFilters(view.refine);
      applyDisplaySnapshot(
        mergeDisplay(defaultDisplay, view.display),
        table,
        setDensity,
        setViewType,
        columnsConfig,
      );
    },
    [views, defaultDisplay, table, setDensity, setViewType, columnsConfig],
  );

  const saveView = useCallback(async () => {
    if (!(activeViewId && viewAdapter)) return;
    const display = toDisplaySnapshot(table, density, viewType, columnsConfig);
    await viewAdapter.updateView(activeViewId, {
      display,
      refine: table.state.dataFilters,
    });
    queryClient.invalidateQueries({
      queryKey: ["data-explorer", "views", domain],
    });
  }, [
    activeViewId,
    columnsConfig,
    density,
    domain,
    queryClient,
    table,
    viewAdapter,
    viewType,
  ]);

  const resetToSaved = useCallback(() => {
    if (!activeView) {
      table.setDataFilters([]);
      applyDisplaySnapshot(
        defaultDisplay,
        table,
        setDensity,
        setViewType,
        columnsConfig,
      );
      return;
    }
    table.setDataFilters(activeView.refine);
    applyDisplaySnapshot(
      mergeDisplay(defaultDisplay, activeView.display),
      table,
      setDensity,
      setViewType,
      columnsConfig,
    );
  }, [
    activeView,
    defaultDisplay,
    table,
    setDensity,
    setViewType,
    columnsConfig,
  ]);

  return {
    activeView,
    activeViewId,
    applyView,
    resetToSaved,
    saveView,
    views,
  };
}
