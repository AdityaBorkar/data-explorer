import { useCallback, useMemo, useState } from "react";

import type { ColumnConfig, FilterViewDisplay } from "../types.ts";

export function useDisplay({
  columnsConfig,
  defaultDisplay,
}: {
  columnsConfig: ColumnConfig[];
  defaultDisplay: FilterViewDisplay;
}) {
  const [display, setDisplay] = useState<FilterViewDisplay>(defaultDisplay);

  const updateDisplay = useCallback((updates: Partial<FilterViewDisplay>) => {
    setDisplay((prev) => ({ ...prev, ...updates }));
  }, []);

  const visibleColumns = useMemo(
    () => columnsConfig.filter((c) => display.fields.includes(c.id)),
    [columnsConfig, display.fields],
  );

  return {
    display,
    setDisplay,
    updateDisplay,
    visibleColumns,
  };
}
