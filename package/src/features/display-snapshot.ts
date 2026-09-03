import type { ReactTable } from "@tanstack/react-table";

import type { ColumnConfig } from "../columns.ts";
import type { TableFeatures } from "../types.ts";
import type { FilterViewDisplay } from "../views.ts";

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

export function mergeDisplay(
	base: FilterViewDisplay,
	overrides: Partial<FilterViewDisplay>,
): FilterViewDisplay {
	return {
		columnWidths: overrides.columnWidths ?? base.columnWidths,
		density: overrides.density ?? base.density,
		fields: overrides.fields ?? base.fields,
		groupBy: overrides.groupBy ?? base.groupBy,
		orderBy: overrides.orderBy ?? base.orderBy,
		orderType: overrides.orderType ?? base.orderType,
		type: overrides.type ?? base.type,
	};
}

const DENSITIES = ["compact", "comfortable", "spacious"] as const;
const DIRS = ["asc", "desc"] as const;
const VIEW_TYPES = ["table", "board", "timeline"] as const;

export function serializeDisplay(display: FilterViewDisplay): URLSearchParams {
	const params = new URLSearchParams();
	params.set("sort", display.orderBy);
	params.set("dir", display.orderType);
	params.delete("cols");
	for (const field of display.fields) params.append("cols", field);
	if (Object.keys(display.columnWidths).length > 0) {
		params.set("widths", JSON.stringify(display.columnWidths));
	}
	params.set("density", display.density);
	params.set("type", display.type);
	if (display.groupBy) params.set("groupBy", display.groupBy);
	return params;
}

export function deserializeDisplay(
	params: URLSearchParams,
	defaults: FilterViewDisplay,
): FilterViewDisplay {
	const rawWidths = params.get("widths");
	const rawDensity = params.get("density");
	const rawDir = params.get("dir");
	const rawType = params.get("type");
	const rawGroupBy = params.get("groupBy");
	const rawSort = params.get("sort");

	let columnWidths = defaults.columnWidths;
	if (rawWidths) {
		try {
			columnWidths = JSON.parse(rawWidths) as Record<string, number>;
		} catch {
			columnWidths = defaults.columnWidths;
		}
	}

	const cols = params
		.getAll("cols")
		.flatMap((v) => v.split(","))
		.map((v) => v.trim())
		.filter(Boolean);
	const fields = cols.length > 0 ? cols : defaults.fields;

	return {
		columnWidths,
		density: (DENSITIES as readonly string[]).includes(rawDensity ?? "")
			? (rawDensity as FilterViewDisplay["density"])
			: defaults.density,
		fields,
		groupBy: rawGroupBy || defaults.groupBy,
		orderBy: rawSort || defaults.orderBy,
		orderType: (DIRS as readonly string[]).includes(rawDir ?? "")
			? (rawDir as FilterViewDisplay["orderType"])
			: defaults.orderType,
		type: (VIEW_TYPES as readonly string[]).includes(rawType ?? "")
			? (rawType as FilterViewDisplay["type"])
			: defaults.type,
	};
}
