import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactTable } from "@tanstack/react-table";
import { useCallback, useMemo, useState } from "react";

import { mergeDisplay } from "../features/data-filtering/filter-merge.ts";
import {
  applyDisplaySnapshot,
  toDisplaySnapshot,
} from "../features/display-snapshot.ts";
import type {
  ColumnConfig,
  FilterViewDisplay,
  TableFeatures,
  ViewAdapter,
} from "../types.ts";

export function useView({
  columnsConfig,
  defaultDisplay,
  domain,
  table,
  viewAdapter,
}: {
  columnsConfig: ColumnConfig[];
  defaultDisplay: FilterViewDisplay;
  domain: string;
  table: ReactTable<TableFeatures, Record<string, unknown>>;
  viewAdapter?: ViewAdapter;
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
        applyDisplaySnapshot(defaultDisplay, table, columnsConfig);
        return;
      }
      const view = views.find((v) => v.id === viewId);
      if (!view) return;
      table.setDataFilters(view.refine);
      applyDisplaySnapshot(
        mergeDisplay(defaultDisplay, view.display),
        table,
        columnsConfig,
      );
    },
    [views, defaultDisplay, table, columnsConfig],
  );

  const saveView = useCallback(async () => {
    if (!(activeViewId && viewAdapter)) return;
    const display = toDisplaySnapshot(table, columnsConfig);
    await viewAdapter.updateView(activeViewId, {
      display,
      refine: table.state.dataFilters,
    });
    queryClient.invalidateQueries({
      queryKey: ["data-explorer", "views", domain],
    });
  }, [activeViewId, columnsConfig, domain, queryClient, table, viewAdapter]);

  const resetToSaved = useCallback(() => {
    if (!activeView) {
      table.setDataFilters([]);
      applyDisplaySnapshot(defaultDisplay, table, columnsConfig);
      return;
    }
    table.setDataFilters(activeView.refine);
    applyDisplaySnapshot(
      mergeDisplay(defaultDisplay, activeView.display),
      table,
      columnsConfig,
    );
  }, [activeView, defaultDisplay, table, columnsConfig]);

  return {
    activeView,
    activeViewId,
    applyView,
    resetToSaved,
    saveView,
    views,
  };
}
