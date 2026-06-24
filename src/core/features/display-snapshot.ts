import type { ReactTable } from "@tanstack/react-table";

import type {
  ColumnConfig,
  FilterViewDisplay,
  TableFeatures,
} from "../types.ts";

export function toDisplaySnapshot(
  table: ReactTable<TableFeatures, Record<string, unknown>>,
  columnsConfig: ColumnConfig[],
): FilterViewDisplay {
  const first = table.state.sorting[0];
  return {
    columnWidths: { ...table.state.columnSizing },
    density: table.state.density ?? "comfortable",
    fields: columnsConfig
      .filter((c) => table.state.columnVisibility[c.id] !== false)
      .map((c) => c.id),
    groupBy: table.state.grouping[0] ?? null,
    orderBy: first?.id ?? "",
    orderType: first?.desc ? "desc" : "asc",
    type: table.state.viewType ?? "table",
  };
}

export function applyDisplaySnapshot(
  snapshot: FilterViewDisplay,
  table: ReactTable<TableFeatures, Record<string, unknown>>,
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
  table.setDensity(snapshot.density);
  table.setViewType(snapshot.type);
}
