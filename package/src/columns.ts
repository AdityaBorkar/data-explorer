import type { DataExplorerErrorCode } from "./errors.ts";
import { DataExplorerError } from "./errors.ts";
import type { FilterOperator } from "./filters.ts";

export type ColumnDataType =
	| "string"
	| "number"
	| "date"
	| "boolean"
	| "enum"
	| "multiEnum";

/**
 * Global-search pseudo column.
 *
 * Divergence contract: drafts targeting `_search` pin the `contains`
 * operator and jump straight to the value phase (`filter-draft.ts`), and
 * the SQL builder fans the term out to `ILIKE … OR …` across every
 * `searchable` column (`sql/filter-sql.ts`). Never hand-build
 * `{ columnId: "_search", operator: "contains" }` — use
 * {@link createSearchFilter} instead.
 */
export const SEARCH_COLUMN_ID = "_search" as const;

export function isSearchColumnId(id: string): boolean {
	return id === SEARCH_COLUMN_ID;
}

export function isSearchColumn(col: { id: string } | string): boolean {
	return typeof col === "string"
		? isSearchColumnId(col)
		: isSearchColumnId(col.id);
}

export interface DataExplorerColumnMeta<TIcon = unknown> {
	displayName: string;
	endOf?: "timeline";
	icon?: TIcon;
	max?: number;
	min?: number;
	operators?: FilterOperator[];
	options?: { label: string; value: string }[];
	/** Override for single-click quick-add (`quickAddCondition`). Defaults to `includeAny` on `multiEnum`, `eq` elsewhere. */
	quickOperator?: FilterOperator;
	searchable?: boolean;
	startOf?: "timeline";
	type: ColumnDataType;
}

/** Minimal column shape for filter semantics (operator allow-list + type). */
export type ColumnSemantics = Pick<
	DataExplorerColumnMeta,
	"operators" | "type"
>;

/** Headless column descriptor derived from a TanStack column def's `meta`. */
export interface ColumnConfig<TIcon = unknown>
	extends DataExplorerColumnMeta<TIcon> {
	id: string;
}

/** One skipped column definition, collected instead of `console.warn`. */
export interface ColumnIssue {
	code: DataExplorerErrorCode;
	/** The offending `id`, when the definition had one. */
	id?: string;
	index: number;
	message: string;
}

export interface ExtractColumnConfigOptions {
	/**
	 * Called once per skipped definition. When omitted, issues are silently
	 * skipped (library code never logs). Pass `strict: true` to throw instead.
	 */
	onInvalidColumn?: (issue: ColumnIssue) => void;
	/** Fail fast with `DataExplorerError("INVALID_COLUMN_DEF")` on the first issue. */
	strict?: boolean;
}

const KNOWN_COLUMN_TYPES: ReadonlySet<string> = new Set([
	"string",
	"number",
	"date",
	"boolean",
	"enum",
	"multiEnum",
]);

/** Explicit meta boundary: rejects non-objects and unknown types instead of spreading garbage. */
function isColumnMeta(meta: unknown): meta is DataExplorerColumnMeta {
	if (typeof meta !== "object" || meta === null) return false;
	const candidate = meta as Record<string, unknown>;
	return (
		typeof candidate.displayName === "string" &&
		typeof candidate.type === "string" &&
		KNOWN_COLUMN_TYPES.has(candidate.type)
	);
}

function toColumnConfig(
	id: string,
	meta: DataExplorerColumnMeta,
): ColumnConfig {
	const config: ColumnConfig = {
		displayName: meta.displayName,
		id,
		type: meta.type,
	};
	if (meta.endOf !== undefined) config.endOf = meta.endOf;
	if (meta.icon !== undefined) config.icon = meta.icon;
	if (meta.max !== undefined) config.max = meta.max;
	if (meta.min !== undefined) config.min = meta.min;
	if (meta.operators !== undefined) config.operators = [...meta.operators];
	if (meta.options !== undefined) {
		config.options = meta.options.map((o) => ({
			label: o.label,
			value: o.value,
		}));
	}
	if (meta.quickOperator !== undefined)
		config.quickOperator = meta.quickOperator;
	if (meta.searchable !== undefined) config.searchable = meta.searchable;
	if (meta.startOf !== undefined) config.startOf = meta.startOf;
	return config;
}

/**
 * Strict variant of {@link extractColumnConfigs}: returns both the usable
 * configs and the per-definition issues that were skipped.
 */
export function extractColumnConfigsDetailed(
	defs: ReadonlyArray<{ id?: string; meta?: unknown }>,
	options?: ExtractColumnConfigOptions,
): { configs: ColumnConfig[]; issues: ColumnIssue[] } {
	const configs: ColumnConfig[] = [];
	const issues: ColumnIssue[] = [];
	defs.forEach((def, index) => {
		if (def.id == null) {
			issues.push({
				code: "INVALID_COLUMN_DEF",
				index,
				message: `[data-explorer] column at index ${index} missing id; skipped`,
			});
			return;
		}
		const meta: unknown = def.meta;
		if (!isColumnMeta(meta)) {
			issues.push({
				code: "INVALID_COLUMN_DEF",
				id: def.id,
				index,
				message: `[data-explorer] column "${def.id}" missing displayName/type; skipped`,
			});
			return;
		}
		configs.push(toColumnConfig(def.id, meta));
	});
	const first = issues[0];
	if (options?.strict && first !== undefined) {
		const details: Record<string, unknown> = { index: first.index };
		if (first.id !== undefined) details.id = first.id;
		throw new DataExplorerError("INVALID_COLUMN_DEF", first.message, details);
	}
	for (const issue of issues) options?.onInvalidColumn?.(issue);
	return { configs, issues };
}

/**
 * Derive headless column configs from TanStack column defs.
 * Invalid definitions are skipped; observe them via `options.onInvalidColumn`
 * or fail fast with `options.strict` (throws in dev *and* prod — prefer
 * `strict: process.env.NODE_ENV !== "production"` at the call site).
 */
export function extractColumnConfigs(
	defs: ReadonlyArray<{ id?: string; meta?: unknown }>,
	options?: ExtractColumnConfigOptions,
): ColumnConfig[] {
	return extractColumnConfigsDetailed(defs, options).configs;
}
