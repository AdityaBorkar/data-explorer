import { useCallback, useMemo, useState } from "react";

import type { FilterCondition } from "../types.ts";

export function useFilters() {
  const [conditions, setConditions] = useState<FilterCondition[]>([]);

  const addFilter = useCallback((v: FilterCondition) => {
    setConditions((prev) => [...prev, v]);
  }, []);

  const clearFilters = useCallback(() => {
    setConditions([]);
  }, []);

  const removeFilter = useCallback((id: string) => {
    setConditions((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const setFilters = useCallback((v: FilterCondition[]) => {
    setConditions(v);
  }, []);

  const updateFilter = useCallback(
    (id: string, updates: Partial<FilterCondition>) => {
      setConditions((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...updates } : item)),
      );
    },
    [],
  );

  return useMemo(
    () => ({
      addFilter,
      clearFilters,
      filterConditions: conditions,
      removeFilter,
      setFilters,
      updateFilter,
    }),
    [
      addFilter,
      clearFilters,
      conditions,
      removeFilter,
      setFilters,
      updateFilter,
    ],
  );
}
