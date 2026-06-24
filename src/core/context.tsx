import type { ReactTable, RowSelectionState } from "@tanstack/react-table";
import { createContext, useContext, useMemo } from "react";

import type { DataExplorerTableFeatures } from "./features";
import type {
  ColumnConfig,
  ContextType,
  DataExplorerContextType,
  FilterViewDisplay,
  TableContextType,
} from "./types.ts";

export const DataExplorerContext =
  createContext<DataExplorerContextType | null>(null);
export const TableContext = createContext<TableContextType | null>(null);

function useNonNullContext<T>(ctx: React.Context<T | null>, name: string): T {
  const value = useContext(ctx);
  if (!value) {
    throw new Error(`${name} must be used within DataExplorerProvider`);
  }
  return value;
}

export function useDataExplorerContext<
  TItem = unknown,
>(): DataExplorerContextType<TItem> {
  return useNonNullContext(
    DataExplorerContext,
    "useDataExplorerContext",
  ) as DataExplorerContextType<TItem>;
}

export function useTableContext<
  TItem extends Record<string, unknown> = Record<string, unknown>,
>(): { table: ReactTable<DataExplorerTableFeatures, TItem> } {
  const { table } = useNonNullContext(TableContext, "useTableContext");
  return {
    table: table as unknown as ReactTable<DataExplorerTableFeatures, TItem>,
  };
}

export function useConfigContext(): { columnsConfig: ColumnConfig[] } {
  const { columnsConfig } = useDataExplorerContext();
  return useMemo(() => ({ columnsConfig }), [columnsConfig]);
}

export function useDisplayContext(): {
  display: FilterViewDisplay;
  updateDisplay: (updates: Partial<FilterViewDisplay>) => void;
} {
  const { display, updateDisplay } = useDataExplorerContext();
  return useMemo(() => ({ display, updateDisplay }), [display, updateDisplay]);
}

export function useDataContext<
  TItem = unknown,
>(): DataExplorerContextType<TItem>["data"] {
  const { data } = useDataExplorerContext<TItem>();
  return data;
}

export function useViewContext(): DataExplorerContextType["view"] {
  const { view } = useDataExplorerContext();
  return view;
}

export function useCallbackContext(): {
  onMove?: DataExplorerContextType["onMove"];
} {
  const { onMove } = useDataExplorerContext();
  return useMemo(() => ({ onMove }), [onMove]);
}

export interface SelectionState {
  allRowIds: string[];
  clearSelection: () => void;
  selectAll: () => void;
  selectedRowIds: Set<string>;
  toggleRowSelection: (id: string) => void;
}

export function useSelectionContext(): SelectionState {
  const { table } = useTableContext();
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

export function useDataExplorerContextFull<
  TItem = unknown,
>(): ContextType<TItem> {
  const ctx = useDataExplorerContext<TItem>();
  const { table } = useTableContext();
  return useMemo(() => ({ ...ctx, table }), [ctx, table]);
}
