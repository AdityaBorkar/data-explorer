import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";

import { mergeDisplay } from "../features/data-filtering/filter-merge.ts";
import type { FilterCondition, FilterViewDisplay } from "../types.ts";
import type { ViewAdapter } from "../view-adapter.ts";

export function useView({
  dataFilters,
  defaultDisplay,
  display,
  domain,
  setDataFilters,
  setDisplay,
  viewAdapter,
}: {
  dataFilters: FilterCondition[];
  defaultDisplay: FilterViewDisplay;
  display: FilterViewDisplay;
  domain: string;
  setDataFilters: (filters: FilterCondition[]) => void;
  setDisplay: (v: FilterViewDisplay) => void;
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
        setDataFilters([]);
        setDisplay(defaultDisplay);
        return;
      }
      const view = views.find((v) => v.id === viewId);
      if (!view) return;
      setDataFilters(view.refine);
      setDisplay(mergeDisplay(defaultDisplay, view.display));
    },
    [views, defaultDisplay, setDataFilters, setDisplay],
  );

  const saveView = useCallback(async () => {
    if (!(activeViewId && viewAdapter)) return;
    await viewAdapter.updateView(activeViewId, {
      display,
      refine: dataFilters,
    });
    queryClient.invalidateQueries({
      queryKey: ["data-explorer", "views", domain],
    });
  }, [activeViewId, dataFilters, display, domain, queryClient, viewAdapter]);

  const resetToSaved = useCallback(() => {
    if (!activeView) {
      setDataFilters([]);
      setDisplay(defaultDisplay);
      return;
    }
    setDataFilters(activeView.refine);
    setDisplay(mergeDisplay(defaultDisplay, activeView.display));
  }, [activeView, defaultDisplay, setDataFilters, setDisplay]);

  return {
    activeView,
    activeViewId,
    applyView,
    resetToSaved,
    saveView,
    views,
  };
}
