import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";

import { mergeDisplay } from "../filter/filter-merge.ts";
import type { FilterCondition, FilterViewDisplay } from "../types.ts";
import type { ViewAdapter } from "../view-adapter.ts";

export function useView({
  defaultDisplay,
  display,
  domain,
  filterConditions,
  setFilters,
  setDisplay,
  viewAdapter,
}: {
  defaultDisplay: FilterViewDisplay;
  display: FilterViewDisplay;
  domain: string;
  filterConditions: FilterCondition[];
  setFilters: (v: FilterCondition[]) => void;
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
        setFilters([]);
        setDisplay(defaultDisplay);
        return;
      }
      const view = views.find((v) => v.id === viewId);
      if (!view) return;
      setFilters(view.refine);
      setDisplay(mergeDisplay(defaultDisplay, view.display));
    },
    [views, defaultDisplay, setFilters, setDisplay],
  );

  const saveView = useCallback(async () => {
    if (!(activeViewId && viewAdapter)) return;
    await viewAdapter.updateView(activeViewId, {
      display,
      refine: filterConditions,
    });
    queryClient.invalidateQueries({
      queryKey: ["data-explorer", "views", domain],
    });
  }, [
    activeViewId,
    filterConditions,
    display,
    domain,
    queryClient,
    viewAdapter,
  ]);

  const resetToSaved = useCallback(() => {
    if (!activeView) {
      setFilters([]);
      setDisplay(defaultDisplay);
      return;
    }
    setFilters(activeView.refine);
    setDisplay(mergeDisplay(defaultDisplay, activeView.display));
  }, [activeView, defaultDisplay, setFilters, setDisplay]);

  return {
    activeView,
    activeViewId,
    applyView,
    resetToSaved,
    saveView,
    views,
  };
}
