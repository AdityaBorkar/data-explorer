/**
 * Filter → parameterized `WHERE` builder.
 *
 * Dialects: `postgres` (default, preserves historical output), `sqlite`,
 * `mysql`. Case-insensitive matching is the default (`ILIKE` on Postgres,
 * `LOWER(col) LIKE LOWER(?)` elsewhere); pass `caseSensitive: true` for
 * binary `LIKE`.
 *
 * Historical `include` / `exclude` short names are normalized to
 * `includeAll` / `excludeAll` at the serialization boundary
 * (`deserializeFilters`) and defensively here, so the operator table only
 * carries canonical names. `includeAny` / `excludeAny` use overlap (`&&`).
 */

import type { ColumnConfig } from "../columns.ts";
import { isSearchColumnId } from "../columns.ts";
import { DataExplorerError } from "../errors.ts";
import { groupConditions } from "../features/data-filtering/filter-grouping.ts";
import { validateCondition } from "../features/data-filtering/filter-semantics.ts";
import { normalizeOperator } from "../features/data-filtering/operators.ts";
import type {
	FilterCondition,
	FilterGroup,
	FilterOperator,
} from "../filters.ts";
import { isFilterGroup } from "../filters.ts";

export interface ParameterizedSql {
	params: unknown[];
	sql: string;
}

export type ColumnMapping = Record<string, string>;

/** SQL dialect for generated predicates. Default `postgres` (historical output). */
export type SqlDialect = "postgres" | "sqlite" | "mysql";

export type PlaceholderStyle = "numbered" | "positional";

export interface BuildFilterOptions {
	/** `false` → `ILIKE` / `LOWER(col) LIKE`. @default false */
	caseSensitive?: boolean;
	/** @default "postgres" */
	dialect?: SqlDialect;
	/**
	 * Placeholder rendering. Defaults per dialect (`numbered` for postgres,
	 * `positional` for sqlite/mysql) — pass explicitly for cross-dialect codegen.
	 */
	placeholderStyle?: PlaceholderStyle;
	tableAlias?: string;
}

function ansiQuote(name: string): string {
	return `"${name.replace(/"/g, '""')}"`;
}

function mysqlQuote(name: string): string {
	return `\`${name.replace(/`/g, "``")}\``;
}

function quoteIdent(name: string, dialect: SqlDialect): string {
	return dialect === "mysql" ? mysqlQuote(name) : ansiQuote(name);
}

function buildLike(
	col: string,
	param: string,
	not: boolean,
	dialect: SqlDialect,
	caseSensitive: boolean,
): string {
	const keyword = not ? "NOT LIKE" : "LIKE";
	if (dialect === "postgres" && caseSensitive) {
		return `${col} ${keyword} ${param} ESCAPE '\\'`;
	}
	if (dialect === "postgres") {
		const ilike = not ? "NOT ILIKE" : "ILIKE";
		return `${col} ${ilike} ${param} ESCAPE '\\'`;
	}
	if (caseSensitive) return `${col} ${keyword} ${param} ESCAPE '\\'`;
	return `LOWER(${col}) ${keyword} LOWER(${param}) ESCAPE '\\'`;
}

function assertArraySupported(operator: string, dialect: SqlDialect): void {
	if (dialect !== "postgres") {
		throw new DataExplorerError(
			"UNSUPPORTED_DIALECT",
			`Operator "${operator}" needs Postgres text[] containment; no equivalent exists for dialect "${dialect}".`,
			{ dialect, operator },
		);
	}
}

interface BuildContext {
	caseSensitive: boolean;
	columnMap: Map<string, ColumnConfig>;
	dialect: SqlDialect;
	nextIdx: number;
	params: unknown[];
	placeholderStyle: PlaceholderStyle;
}

function pushParam(ctx: BuildContext, value: unknown): string {
	ctx.params.push(value);
	return ctx.placeholderStyle === "positional" ? "?" : `$${ctx.nextIdx++}`;
}

function colRef(
	columnName: string,
	tableAlias: string | undefined,
	dialect: SqlDialect,
): string {
	const quoted = quoteIdent(columnName, dialect);
	return tableAlias ? `${quoteIdent(tableAlias, dialect)}.${quoted}` : quoted;
}

/** Escape LIKE wildcards so user input matches literally. */
function escapeLikePattern(value: string): string {
	return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/** Single validation entry point with explicit matchable codes (see `validateCondition`). */
function validateConditions(
	conditions: FilterCondition[],
	columnMap: Map<string, ColumnConfig>,
): void {
	for (const cond of conditions) {
		const error = validateCondition(cond, columnMap);
		if (error) {
			throw new DataExplorerError(error.code, error.message, error.details);
		}
	}
}

type SqlBuilder = (
	col: string,
	cond: FilterCondition,
	ctx: BuildContext,
) => string;

function assertArrayValue(
	cond: FilterCondition,
): asserts cond is FilterCondition & { value: unknown[] } {
	if (!Array.isArray(cond.value)) {
		throw new DataExplorerError(
			"INVALID_FILTER_VALUE",
			`Invalid filter condition: Operator "${cond.operator}" requires string[] value`,
			{ columnId: cond.columnId, operator: cond.operator },
		);
	}
}

function assertStringValue(
	cond: FilterCondition,
): asserts cond is FilterCondition & { value: string } {
	if (typeof cond.value !== "string") {
		throw new DataExplorerError(
			"INVALID_FILTER_VALUE",
			`Invalid filter condition: Operator "${cond.operator}" requires a non-null value`,
			{ columnId: cond.columnId, operator: cond.operator },
		);
	}
}

function assertRangeValue(
	cond: FilterCondition,
): asserts cond is FilterCondition & { value: [unknown, unknown] } {
	if (!Array.isArray(cond.value) || cond.value.length !== 2) {
		throw new DataExplorerError(
			"INVALID_FILTER_VALUE",
			`Invalid filter condition: Operator "${cond.operator}" requires [min, max] tuple`,
			{ columnId: cond.columnId, operator: cond.operator },
		);
	}
}

function arrayOp(
	col: string,
	cond: FilterCondition,
	ctx: BuildContext,
	op: "@>" | "&&",
): string {
	assertArraySupported(cond.operator, ctx.dialect);
	assertArrayValue(cond);
	// Postgres text[] containment/overlap.
	return `${col} ${op} ARRAY[${cond.value.map((v) => pushParam(ctx, v)).join(", ")}]::text[]`;
}

function notArrayOp(
	col: string,
	cond: FilterCondition,
	ctx: BuildContext,
	op: "@>" | "&&",
): string {
	return `NOT (${arrayOp(col, cond, ctx, op)})`;
}

function betweenOp(
	col: string,
	cond: FilterCondition,
	ctx: BuildContext,
	not: boolean,
): string {
	assertRangeValue(cond);
	const [min, max] = cond.value;
	const keyword = not ? "NOT BETWEEN" : "BETWEEN";
	return `${col} ${keyword} ${pushParam(ctx, min)} AND ${pushParam(ctx, max)}`;
}

function likeOp(
	col: string,
	cond: FilterCondition,
	ctx: BuildContext,
	pattern: (v: string) => string,
	not: boolean,
): string {
	assertStringValue(cond);
	const param = pushParam(ctx, pattern(escapeLikePattern(cond.value)));
	return buildLike(col, param, not, ctx.dialect, ctx.caseSensitive);
}

function comparisonBuilder(op: string): SqlBuilder {
	return (col, cond, ctx) => `${col} ${op} ${pushParam(ctx, cond.value)}`;
}

type NonNullaryOperator = Exclude<FilterOperator, "isEmpty" | "isNotEmpty">;

const OPERATOR_SQL_BUILDERS: Record<NonNullaryOperator, SqlBuilder> = {
	between: (col, cond, ctx) => betweenOp(col, cond, ctx, false),
	contains: (col, cond, ctx) => likeOp(col, cond, ctx, (v) => `%${v}%`, false),
	endsWith: (col, cond, ctx) => likeOp(col, cond, ctx, (v) => `%${v}`, false),
	eq: comparisonBuilder("="),
	excludeAll: (col, cond, ctx) => notArrayOp(col, cond, ctx, "@>"),
	excludeAny: (col, cond, ctx) => notArrayOp(col, cond, ctx, "&&"),
	gt: comparisonBuilder(">"),
	gte: comparisonBuilder(">="),
	in: (col, cond, ctx) => {
		assertArrayValue(cond);
		if (cond.value.length === 0) return "(1=0)";
		return `${col} IN (${cond.value.map((v) => pushParam(ctx, v)).join(", ")})`;
	},
	includeAll: (col, cond, ctx) => arrayOp(col, cond, ctx, "@>"),
	includeAny: (col, cond, ctx) => arrayOp(col, cond, ctx, "&&"),
	lt: comparisonBuilder("<"),
	lte: comparisonBuilder("<="),
	neq: comparisonBuilder("!="),
	notBetween: (col, cond, ctx) => betweenOp(col, cond, ctx, true),
	notContains: (col, cond, ctx) =>
		likeOp(col, cond, ctx, (v) => `%${v}%`, true),
	notIn: (col, cond, ctx) => {
		assertArrayValue(cond);
		if (cond.value.length === 0) return "(1=1)";
		return `${col} NOT IN (${cond.value.map((v) => pushParam(ctx, v)).join(", ")})`;
	},
	startsWith: (col, cond, ctx) => likeOp(col, cond, ctx, (v) => `${v}%`, false),
};

function isEmptySql(
	col: string,
	type: ColumnConfig["type"] | undefined,
): string {
	// Empty strings read as empty for text; other types only match NULL.
	if (type === "string") return `(${col} IS NULL OR ${col} = '')`;
	return `${col} IS NULL`;
}

function buildConditionSql(
	condition: FilterCondition,
	columnMapping: ColumnMapping,
	ctx: BuildContext,
	tableAlias: string | undefined,
): string {
	if (isSearchColumnId(condition.columnId)) {
		assertStringValue(condition);
		return buildSearchSql(condition.value, columnMapping, ctx, tableAlias);
	}

	const columnName = columnMapping[condition.columnId];
	if (!columnName) {
		throw new DataExplorerError(
			"MISSING_MAPPING",
			`Missing column mapping for "${condition.columnId}"`,
			{ columnId: condition.columnId },
		);
	}

	const col = colRef(columnName, tableAlias, ctx.dialect);

	if (condition.operator === "isEmpty" || condition.operator === "isNotEmpty") {
		const type = ctx.columnMap.get(condition.columnId)?.type;
		if (condition.operator === "isEmpty") return isEmptySql(col, type);
		return type === "string"
			? `(${col} IS NOT NULL AND ${col} != '')`
			: `${col} IS NOT NULL`;
	}

	const canonical = normalizeOperator(condition.operator) ?? condition.operator;
	const builder: SqlBuilder | undefined =
		canonical === "isEmpty" || canonical === "isNotEmpty"
			? undefined
			: OPERATOR_SQL_BUILDERS[canonical];
	if (!builder) {
		throw new DataExplorerError(
			"INVALID_OPERATOR",
			`Unhandled filter operator: ${condition.operator}`,
			{ columnId: condition.columnId, operator: condition.operator },
		);
	}

	return builder(col, condition, ctx);
}

function buildSearchSql(
	searchTerm: string,
	columnMapping: ColumnMapping,
	ctx: BuildContext,
	tableAlias: string | undefined,
): string {
	const searchableCols = [...ctx.columnMap.values()].filter(
		(c) => c.searchable && !isSearchColumnId(c.id),
	);

	if (searchableCols.length === 0) {
		throw new DataExplorerError(
			"NO_SEARCHABLE_COLUMN",
			"Search filter requires at least one searchable column",
		);
	}

	// Reuse the regular `contains` path per column so mapping, quoting, and
	// LIKE rendering stay in one place. Synthetic conditions can't recurse:
	// their `columnId` is never `_search`.
	const conditions = searchableCols.map((colConfig) =>
		buildConditionSql(
			{
				columnId: colConfig.id,
				combinator: "and",
				id: `search-${colConfig.id}`,
				operator: "contains",
				value: searchTerm,
			},
			columnMapping,
			ctx,
			tableAlias,
		),
	);

	return conditions.length === 1
		? (conditions[0] as string)
		: `(${conditions.join(" OR ")})`;
}

function buildGroupSql(
	group: FilterGroup,
	columnMapping: ColumnMapping,
	ctx: BuildContext,
	tableAlias: string | undefined,
): string {
	const sqls: string[] = [];

	for (const item of group.conditions) {
		const sub = isFilterGroup(item)
			? buildGroupSql(item, columnMapping, ctx, tableAlias)
			: buildConditionSql(item, columnMapping, ctx, tableAlias);
		sqls.push(sub);
	}

	if (sqls.length === 0) {
		throw new DataExplorerError("EMPTY_GROUP", "Empty filter group");
	}
	if (sqls.length === 1) return sqls[0] as string;

	const joiner = group.combinator === "or" ? " OR " : " AND ";
	return `(${sqls.join(joiner)})`;
}

/**
 * Build a parameterized `WHERE` fragment.
 *
 * Always returns a result — empty filters yield `{ sql: "", params: [] }`
 * (no `undefined` branching at call sites).
 *
 * @example
 * ```ts
 * // Postgres (default)
 * buildFilterWhere(filters, columns, mapping, { tableAlias: "tasks" });
 * // SQLite
 * buildFilterWhere(filters, columns, mapping, { dialect: "sqlite" });
 * ```
 */
export function buildFilterWhere(
	conditions: FilterCondition[],
	columnsConfig: ColumnConfig[],
	columnMapping: ColumnMapping,
	options?: BuildFilterOptions,
): ParameterizedSql {
	const {
		tableAlias,
		dialect = "postgres",
		caseSensitive = false,
		placeholderStyle = dialect === "postgres" ? "numbered" : "positional",
	} = options ?? {};
	const columnMap = new Map(columnsConfig.map((c) => [c.id, c]));
	validateConditions(conditions, columnMap);
	if (conditions.length === 0) return { params: [], sql: "" };

	const group = groupConditions(conditions);

	const ctx: BuildContext = {
		caseSensitive,
		columnMap,
		dialect,
		nextIdx: 1,
		params: [],
		placeholderStyle,
	};

	const sql = buildGroupSql(group, columnMapping, ctx, tableAlias);

	return { params: [...ctx.params], sql };
}
