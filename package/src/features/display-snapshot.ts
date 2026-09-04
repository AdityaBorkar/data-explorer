import type { ReactTable } from "@tanstack/react-table";
import { startTransition } from "react";

import type { ColumnConfig } from "../columns.ts";
import type { TableFeatures } from "../types.ts";
import type { Density, FilterViewDisplay, ViewType } from "../views.ts";

type DisplayTable = ReactTable<TableFeatures, Record<string, unknown>>;

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
export function toInitialSorting(display: FilterViewDisplay) {
	return display.orderBy
		? [{ desc: display.orderType === "desc", id: display.orderBy }]
		: [];
}

/** See {@link toInitialSorting} — single-group by design. */
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

function encodeWidths(widths: Record<string, number>): string {
	const json = JSON.stringify(widths);
	// btoa is ASCII-safe for JSON widths maps; fall back to raw JSON where
	// base64 is unavailable (non-DOM runtimes without a polyfill).
	try {
		if (typeof btoa === "function") return `b64:${btoa(json)}`;
	} catch {
		// fall through to raw JSON
	}
	return json;
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
	if (raw.startsWith("b64:")) {
		try {
			if (typeof atob === "function") {
				const decoded = parse(atob(raw.slice(4)));
				if (decoded) return decoded;
			}
		} catch {
			// fall through to legacy JSON, then defaults
		}
	}
	return parse(raw) ?? defaults;
}

/**
 * Compact share-link encoding: column widths ride base64 (`widths=b64:…`),
 * legacy raw-JSON links still decode. Widths are omitted when empty.
 */
export function serializeDisplay(display: FilterViewDisplay): URLSearchParams {
	const params = new URLSearchParams();
	params.set("sort", display.orderBy);
	params.set("dir", display.orderType);
	params.delete("cols");
	for (const field of display.fields) params.append("cols", field);
	if (Object.keys(display.columnWidths).length > 0) {
		params.set("widths", encodeWidths(display.columnWidths));
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
		density: (DENSITIES as readonly string[]).includes(rawDensity ?? "")
			? (rawDensity as FilterViewDisplay["density"])
			: defaults.density,
		fields,
		groupBy: rawGroupBy || defaults.groupBy,
		orderBy: rawSort || defaults.orderBy,
		orderType: (["asc", "desc"] as readonly string[]).includes(rawDir ?? "")
			? (rawDir as FilterViewDisplay["orderType"])
			: defaults.orderType,
		type: (VIEW_TYPES as readonly string[]).includes(rawType ?? "")
			? (rawType as FilterViewDisplay["type"])
			: defaults.type,
	};
}
