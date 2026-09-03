import type { FilterOperator } from "./filters.ts";

export type ColumnDataType =
	| "string"
	| "number"
	| "date"
	| "boolean"
	| "enum"
	| "multiEnum";

export const SEARCH_COLUMN_ID = "_search" as const;

export function isSearchColumn(col: { id: string } | string): boolean {
	return typeof col === "string"
		? col === SEARCH_COLUMN_ID
		: col.id === SEARCH_COLUMN_ID;
}

export interface DataExplorerColumnMeta<TIcon = unknown> {
	displayName: string;
	endOf?: "timeline";
	icon?: TIcon;
	max?: number;
	min?: number;
	operators?: FilterOperator[];
	options?: { label: string; value: string }[];
	searchable?: boolean;
	startOf?: "timeline";
	type: ColumnDataType;
}

export interface ColumnConfig<TIcon = unknown>
	extends DataExplorerColumnMeta<TIcon> {
	id: string;
}

export function extractColumnConfigs(
	defs: ReadonlyArray<{ id?: string; meta?: unknown }>,
): ColumnConfig[] {
	const result: ColumnConfig[] = [];
	defs.forEach((def, index) => {
		if (def.id == null) {
			console.warn(
				`[data-explorer] column at index ${index} missing id; skipped`,
			);
			return;
		}
		const meta = def.meta as DataExplorerColumnMeta | undefined;
		if (meta?.displayName == null || meta?.type == null) {
			console.warn(
				`[data-explorer] column "${def.id}" missing displayName/type; skipped`,
			);
			return;
		}
		result.push({ id: def.id, ...meta });
	});
	return result;
}
