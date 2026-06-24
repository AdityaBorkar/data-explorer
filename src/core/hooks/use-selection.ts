import type {
  ReactTable,
  RowData,
  RowSelectionState,
} from "@tanstack/react-table";
import { useCallback, useMemo } from "react";

import type { DataExplorerTableFeatures } from "../features/index.ts";

/**
 * Row selection backed by a TanStack Table instance. The table's
 * `rowSelection` state is the single source of truth; this hook only projects
 * it into the `Set<string>` shape the rest of the core expects and forwards
 * mutations back to the table.
 */
export function useSelection<TData extends RowData>({
  table,
}: {
  table: ReactTable<DataExplorerTableFeatures, TData>;
}) {
  const rowSelection = table.state.rowSelection;

  const selectedRowIds = useMemo(
    () =>
      new Set(
        Object.keys(rowSelection).filter((id) => rowSelection[id] === true),
      ),
    [rowSelection],
  );

  const setSelectedRowIds = useCallback(
    (ids: Set<string>) => {
      const next: RowSelectionState = {};
      for (const id of ids) next[id] = true;
      table.setRowSelection(next);
    },
    [table],
  );

  const toggleRowSelection = useCallback(
    (id: string) => {
      table.setRowSelection((prev) => {
        const next = { ...prev };
        if (next[id]) delete next[id];
        else next[id] = true;
        return next;
      });
    },
    [table],
  );

  const clearSelection = useCallback(() => table.resetRowSelection(), [table]);

  return useMemo(
    () => ({
      clearSelection,
      selectedRowIds,
      setSelectedRowIds,
      toggleRowSelection,
    }),
    [clearSelection, selectedRowIds, setSelectedRowIds, toggleRowSelection],
  );
}
