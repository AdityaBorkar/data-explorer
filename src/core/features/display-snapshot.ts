import type { ReactTable } from "@tanstack/react-table";

import type {
  ColumnConfig,
  Density,
  FilterViewDisplay,
  ViewType,
} from "../types.ts";
import type { DataExplorerTableFeatures } from "./index.ts";

export function toDisplaySnapshot(
  table: ReactTable<DataExplorerTableFeatures, Record<string, unknown>>,
  density: Density,
  viewType: ViewType,
  columnsConfig: ColumnConfig[],
): FilterViewDisplay {
  const first = table.state.sorting[0];
  return {
    columnWidths: { ...table.state.columnSizing },
    density,
    fields: columnsConfig
      .filter((c) => table.state.columnVisibility[c.id] !== false)
      .map((c) => c.id),
    groupBy: table.state.grouping[0] ?? null,
    orderBy: first?.id ?? "",
    orderType: first?.desc ? "desc" : "asc",
    type: viewType,
  };
}

export function applyDisplaySnapshot(
  snapshot: FilterViewDisplay,
  table: ReactTable<DataExplorerTableFeatures, Record<string, unknown>>,
  setDensity: (density: Density) => void,
  setViewType: (viewType: ViewType) => void,
  columnsConfig: ColumnConfig[],
): void {
  table.setSorting(
    snapshot.orderBy
      ? [{ desc: snapshot.orderType === "desc", id: snapshot.orderBy }]
      : [],
  );
  table.setGrouping(snapshot.groupBy ? [snapshot.groupBy] : []);
  const visibility: Record<string, boolean> = {};
  for (const col of columnsConfig) {
    visibility[col.id] = snapshot.fields.includes(col.id);
  }
  table.setColumnVisibility(visibility);
  table.setColumnSizing({ ...snapshot.columnWidths });
  setDensity(snapshot.density);
  setViewType(snapshot.type);
}
