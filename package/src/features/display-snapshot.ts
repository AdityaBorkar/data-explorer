import type { ReactTable } from "@tanstack/react-table";
import { startTransition } from "react";

import type { ColumnConfig } from "../columns.ts";
import type { FilterCondition } from "../filters.ts";
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

// Single owner of the display setter list: both public apply paths run
// through here so adding a display field touches one place. Called without
// a transition — callers wrap it in their own `startTransition`.
function setDisplayState<TItem extends Record<string, unknown>>(
	table: ReactTable<TableFeatures, TItem>,
	next: {
		columnSizing: Record<string, number>;
		columnVisibility: Record<string, boolean>;
		density: Density;
		grouping: string[];
		sorting: { desc: boolean; id: string }[];
		viewType: ViewType;
	},
): void {
	table.setSorting(next.sorting);
	table.setGrouping(next.grouping);
	table.setColumnVisibility(next.columnVisibility);
	table.setColumnSizing(next.columnSizing);
	table.setDensity(next.density);
	table.setViewType(next.viewType);
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
		setDisplayState(table, next);
	});
}

/**
 * Atomic view application: filters + the 6 display setters in one
 * transition so subscribers never observe a half-applied view. This is the
 * single transaction behind `useView` (`applySnapshot`, `resetToDefault`);
 * `applyDisplaySnapshot` above is the display-only projection of the same
 * setter list.
 */
export function applyTableSnapshot<TItem extends Record<string, unknown>>(
	table: ReactTable<TableFeatures, TItem>,
	columnsConfig: ColumnConfig[],
	args: { display: FilterViewDisplay; refine: FilterCondition[] },
): void {
	const next = toInitialTableState(args.display, columnsConfig);
	const refine = args.refine;
	startTransition(() => {
		table.setDataFilters(refine);
		setDisplayState(table, next);
	});
}

export function mergeDisplay(
	base: FilterViewDisplay,
	overrides: Partial<FilterViewDisplay>,
): FilterViewDisplay {
	return {
		columnWidths: {
			...base.columnWidths,
			...(overrides.columnWidths ?? {}),
		},
		density: overrides.density ?? base.density,
		fields: overrides.fields ?? base.fields,
		groupBy: overrides.groupBy ?? base.groupBy,
		orderBy: overrides.orderBy ?? base.orderBy,
		orderType: overrides.orderType ?? base.orderType,
		type: overrides.type ?? base.type,
	};
}

/** Parse JSON safely, returning `null` instead of throwing. */
function safeJsonParse(text: string): unknown {
	try {
		return JSON.parse(text) as unknown;
	} catch {
		return null;
	}
}

function isWidthMap(value: unknown): value is Record<string, number> {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return false;
	}
	return Object.values(value as Record<string, unknown>).every(
		(v) => typeof v === "number" && Number.isFinite(v),
	);
}

function decodeBase64(input: string): string | null {
	const globals = globalThis as unknown as {
		atob?: unknown;
		Buffer?: unknown;
	};
	if (typeof globals.atob === "function") {
		try {
			return (globals.atob as (data: string) => string)(input);
		} catch {
			return null;
		}
	}
	const bufferCtor = globals.Buffer as
		| { from(data: string, encoding: string): { toString(e: string): string } }
		| undefined;
	if (bufferCtor) {
		try {
			return bufferCtor.from(input, "base64").toString("utf-8");
		} catch {
			return null;
		}
	}
	return null;
}

function decodeWidths(
	raw: string,
	defaults: Record<string, number>,
): Record<string, number> {
	const direct = safeJsonParse(raw);
	if (isWidthMap(direct)) return { ...direct };
	// Legacy `b64:` links (pre-raw-JSON encoder) still decode. Malformed
	// payloads and missing decoders fall back to defaults instead of throwing.
	if (raw.startsWith("b64:")) {
		const text = decodeBase64(raw.slice(4));
		if (text === null) return { ...defaults };
		const decoded = safeJsonParse(text);
		if (isWidthMap(decoded)) return { ...decoded };
	}
	return { ...defaults };
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
		: { ...defaults.columnWidths };

	const cols = params
		.getAll("cols")
		.flatMap((v) => v.split(","))
		.map((v) => v.trim())
		.filter(Boolean);
	const fields = cols.length > 0 ? cols : defaults.fields;

	return {
		columnWidths,
		density: (DENSITIES as readonly string[]).includes(rawDensity ?? "")
			? (rawDensity as Density)
			: defaults.density,
		fields,
		groupBy:
			rawGroupBy === null || rawGroupBy === "" ? defaults.groupBy : rawGroupBy,
		orderBy: rawSort === null || rawSort === "" ? defaults.orderBy : rawSort,
		orderType:
			rawDir === "asc" || rawDir === "desc" ? rawDir : defaults.orderType,
		type: (VIEW_TYPES as readonly string[]).includes(rawType ?? "")
			? (rawType as ViewType)
			: defaults.type,
	};
}
