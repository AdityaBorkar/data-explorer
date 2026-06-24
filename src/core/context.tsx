import type { RowSelectionState } from "@tanstack/react-table";
import { createContext, useContext, useMemo } from "react";

import type { ContextType } from "./types.ts";

export const DataExplorerContext = createContext<ContextType | null>(null);

export function useDataExplorerContext<TItem = unknown>(): ContextType<TItem> {
  const value = useContext(DataExplorerContext);
  if (!value) {
    throw new Error(
      "useDataExplorerContext must be used within DataExplorerProvider",
    );
  }
  return value as ContextType<TItem>;
}

export interface SelectionState {
  allRowIds: string[];
  clearSelection: () => void;
  selectAll: () => void;
  selectedRowIds: Set<string>;
  toggleRowSelection: (id: string) => void;
}

export function useSelectionContext(): SelectionState {
  const { table } = useDataExplorerContext();
  const rowSelection: RowSelectionState = table.state.rowSelection;

  return useMemo(() => {
    const selectedRowIds = new Set(
      Object.keys(rowSelection).filter((id) => rowSelection[id] === true),
    );
    const allRowIds = table.getRowModel().flatRows.map((row) => row.id);

    return {
      allRowIds,
      clearSelection: () => table.resetRowSelection(),
      selectAll: () => table.toggleAllRowsSelected(true),
      selectedRowIds,
      toggleRowSelection: (id: string) =>
        table.setRowSelection((prev) => {
          const next = { ...prev };
          if (next[id]) delete next[id];
          else next[id] = true;
          return next;
        }),
    };
  }, [rowSelection, table]);
}
