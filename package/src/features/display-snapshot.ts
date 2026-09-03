import type { ReactTable } from "@tanstack/react-table";

import type {
	ColumnConfig,
	FilterViewDisplay,
	TableFeatures,
} from "../types.ts";

type DisplayTable = ReactTable<TableFeatures, Record<string, unknown>>;

export function toInitialSorting(display: FilterViewDisplay) {
	return display.orderBy
		? [{ desc: display.orderType === "desc", id: display.orderBy }]
		: [];
}

export function toInitialGrouping(display: FilterViewDisplay) {
	return display.groupBy ? [display.groupBy] : [];
}

export function toInitialColumnVisibility(
	display: FilterViewDisplay,
	columnsConfig: ColumnConfig[],
): Record<string, boolean> {
	const visible = new Set(display.fields);
	const state: Record<string, boolean> = {};
	for (const col of columnsConfig) state[col.id] = visible.has(col.id);
	return state;
}

export function toInitialTableState(
	display: FilterViewDisplay,
	columnsConfig: ColumnConfig[],
) {
	return {
		columnSizing: { ...display.columnWidths },
		columnVisibility: toInitialColumnVisibility(display, columnsConfig),
		density: display.density,
		grouping: toInitialGrouping(display),
		sorting: toInitialSorting(display),
		viewType: display.type,
	};
}

export function toDisplaySnapshot(
	table: DisplayTable,
	columnsConfig: ColumnConfig[],
): FilterViewDisplay {
	const first = table.state.sorting[0];
	return {
		columnWidths: { ...table.state.columnSizing },
		density: table.state.density,
		fields: columnsConfig
			.filter((c) => table.state.columnVisibility[c.id] !== false)
			.map((c) => c.id),
		groupBy: table.state.grouping[0] ?? null,
		orderBy: first?.id ?? "",
		orderType: first?.desc ? "desc" : "asc",
		type: table.state.viewType,
	};
}

// Single transaction: callers get one function instead of 6 sequential setters.
export function applyDisplaySnapshot(
	snapshot: FilterViewDisplay,
	table: DisplayTable,
	columnsConfig: ColumnConfig[],
): void {
	const next = toInitialTableState(snapshot, columnsConfig);
	table.setSorting(next.sorting);
	table.setGrouping(next.grouping);
	table.setColumnVisibility(next.columnVisibility);
	table.setColumnSizing(next.columnSizing);
	table.setDensity(next.density);
	table.setViewType(next.viewType);
}
