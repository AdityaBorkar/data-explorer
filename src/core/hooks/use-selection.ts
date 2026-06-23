import { useCallback, useMemo, useState } from "react";

export function useSelection() {
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());

  const toggleRowSelection = useCallback((id: string) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedRowIds(new Set());
  }, []);

  return useMemo(
    () => ({
      clearSelection,
      selectedRowIds,
      setSelectedRowIds,
      toggleRowSelection,
    }),
    [clearSelection, selectedRowIds, toggleRowSelection],
  );
}
