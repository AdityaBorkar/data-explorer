import type { ReactTable } from "@tanstack/react-table";
import { startTransition } from "react";

import type { ColumnConfig } from "../columns.ts";
import type { TableFeatures } from "../types.ts";
import type { Density, FilterViewDisplay, ViewType } from "../views.ts";

/** Valid density values (also used to validate share-link params). */
export const DENSITIES: readonly Density[] = [
	"compact",
	"comfortable",
	"spacious",
] as const;

/** Valid view-type values (also used to validate share-link params). */
export const VIEW_TYPES: readonly ViewType[] = [
	"table",
	"board",
	"timeline",
] as const;

/**
 * Display snapshots are single-sort / single-group: only the first sorting
 * entry and `grouping[0]` round-trip. Multi-sort tables collapse to their
 * primary key by design.
 */
export function toInitialSorting(
	display: FilterViewDisplay,
): { desc: boolean; id: string }[] {
	return display.orderBy
		? [{ desc: display.orderType === "desc", id: display.orderBy }]
		: [];
}

/** See {@link toInitialSorting} — single-group by design. */
export function toInitialGrouping(display: FilterViewDisplay): string[] {
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
): {
	columnSizing: Record<string, number>;
	columnVisibility: Record<string, boolean>;
	density: Density;
	grouping: string[];
	sorting: { desc: boolean; id: string }[];
	viewType: ViewType;
} {
	return {
		columnSizing: { ...display.columnWidths },
		columnVisibility: toInitialColumnVisibility(display, columnsConfig),
		density: display.density,
		grouping: toInitialGrouping(display),
		sorting: toInitialSorting(display),
		viewType: display.type,
	};
}

export function toDisplaySnapshot<TItem extends Record<string, unknown>>(
	table: ReactTable<TableFeatures, TItem>,
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
export function applyDisplaySnapshot<TItem extends Record<string, unknown>>(
	snapshot: FilterViewDisplay,
	table: ReactTable<TableFeatures, TItem>,
	columnsConfig: ColumnConfig[],
): void {
	const next = toInitialTableState(snapshot, columnsConfig);
	// Atomic from the subscriber's perspective: one transition instead of 6
	// sequential renders.
	startTransition(() => {
		table.setSorting(next.sorting);
		table.setGrouping(next.grouping);
		table.setColumnVisibility(next.columnVisibility);
		table.setColumnSizing(next.columnSizing);
		table.setDensity(next.density);
		table.setViewType(next.viewType);
	});
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

function decodeWidths(
	raw: string,
	defaults: Record<string, number>,
): Record<string, number> {
	const parse = (text: string): Record<string, number> | null => {
		try {
			const value = JSON.parse(text) as unknown;
			if (typeof value === "object" && value !== null) {
				return value as Record<string, number>;
			}
		} catch {
			// handled below
		}
		return null;
	};
	const direct = parse(raw);
	if (direct) return direct;
	// Legacy `b64:` links (pre-raw-JSON encoder) still decode.
	if (raw.startsWith("b64:") && typeof atob === "function") {
		try {
			const decoded = parse(atob(raw.slice(4)));
			if (decoded) return decoded;
		} catch {
			// fall through to defaults
		}
	}
	return defaults;
}

/**
 * Share-link encoding: column widths ride raw JSON (`widths={…}`).
 * Legacy `b64:` links still decode. Widths are omitted when empty.
 */
export function serializeDisplay(display: FilterViewDisplay): URLSearchParams {
	const params = new URLSearchParams();
	params.set("sort", display.orderBy);
	params.set("dir", display.orderType);
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

	const columnWidths = rawWidths
		? decodeWidths(rawWidths, defaults.columnWidths)
		: defaults.columnWidths;

	const cols = params
		.getAll("cols")
		.flatMap((v) => v.split(","))
		.map((v) => v.trim())
		.filter(Boolean);
	const fields = cols.length > 0 ? cols : defaults.fields;

	return {
		columnWidths,
		density: isOneOf(DENSITIES, rawDensity) ? rawDensity : defaults.density,
		fields,
		groupBy: rawGroupBy || defaults.groupBy,
		orderBy: rawSort || defaults.orderBy,
		orderType: isOneOf(["asc", "desc"] as const, rawDir)
			? rawDir
			: defaults.orderType,
		type: isOneOf(VIEW_TYPES, rawType) ? rawType : defaults.type,
	};
}

function isOneOf<T extends string>(
	list: readonly T[],
	value: string | null,
): value is T {
	return value !== null && (list as readonly string[]).includes(value);
}
