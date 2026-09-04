/**
 * Filter → parameterized `WHERE` builder.
 *
 * Dialects: `postgres` (default, preserves historical output), `sqlite`,
 * `mysql`. Case-insensitive matching is the default (`ILIKE` on Postgres,
 * `LOWER(col) LIKE LOWER(?)` elsewhere); pass `caseSensitive: true` for
 * binary `LIKE`.
 *
 * Alias contract: `include` ≡ `includeAll` (contains-all, `@>`) and
 * `exclude` ≡ `excludeAll` (`NOT (@>)`). The short names are historical
 * duplicates — prefer `includeAll` / `excludeAll` in new code. `includeAny`
 * / `excludeAny` use overlap (`&&`).
 */

import { FilterSqlError } from "../errors.ts";
import { filterConditionSchema } from "../features/data-filtering/filter-condition-schema.ts";
import { groupConditions } from "../features/data-filtering/filter-grouping.ts";
import { validateFilterValue } from "../features/data-filtering/filter-semantics.ts";
import { getOperatorsForType } from "../features/data-filtering/operators.ts";
import type {
	ColumnConfig,
	FilterCondition,
	FilterGroup,
	FilterOperator,
} from "../types.ts";
import { isFilterGroup, isSearchColumn } from "../types.ts";

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
	/**
	 * Prebuilt column lookup for servers building many queries per request
	 * (avoids rebuilding the `Map` per call).
	 */
	columnMap?: Map<string, ColumnConfig>;
	/** @default "postgres" */
	dialect?: SqlDialect;
	/**
	 * Placeholder rendering. Defaults per dialect (`numbered` for postgres,
	 * `positional` for sqlite/mysql) — pass explicitly for cross-dialect codegen.
	 */
	placeholderStyle?: PlaceholderStyle;
	tableAlias?: string;
}

interface BuildContext {
	caseSensitive: boolean;
	columnMap: Map<string, ColumnConfig>;
	dialect: SqlDialect;
	nextIdx: number;
	params: unknown[];
	placeholder: PlaceholderStyle;
}

function pushParam(ctx: BuildContext, value: unknown): string {
	ctx.params.push(value);
	return ctx.placeholder === "positional" ? "?" : `$${ctx.nextIdx++}`;
}

function quoteIdent(name: string, dialect: SqlDialect): string {
	if (dialect === "mysql") return `\`${name.replace(/`/g, "``")}\``;
	return `"${name.replace(/"/g, '""')}"`;
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

function likePattern(value: string, wrap: (v: string) => string): string {
	return wrap(escapeLikePattern(value));
}

function resolveColumnMap(
	columnsConfig: ColumnConfig[],
	prebuilt?: Map<string, ColumnConfig>,
): Map<string, ColumnConfig> {
	return prebuilt ?? new Map(columnsConfig.map((c) => [c.id, c]));
}

function validateConditions(
	conditions: FilterCondition[],
	columnMap: Map<string, ColumnConfig>,
): void {
	for (const cond of conditions) {
		const parsed = filterConditionSchema.safeParse(cond);
		if (!parsed.success) {
			throw new FilterSqlError(
				"INVALID_FILTER_VALUE",
				`Invalid filter condition: ${parsed.error.message}`,
				{ columnId: cond.columnId },
			);
		}

		if (isSearchColumn(cond.columnId)) {
			if (cond.operator !== "contains") {
				throw new FilterSqlError(
					"INVALID_OPERATOR",
					`Invalid operator "${cond.operator}" for search`,
					{ columnId: cond.columnId, operator: cond.operator },
				);
			}
			if (typeof cond.value !== "string" || cond.value.length === 0) {
				throw new FilterSqlError(
					"INVALID_FILTER_VALUE",
					"Search filter requires a non-empty string value",
					{ columnId: cond.columnId },
				);
			}
			continue;
		}

		const colConfig = columnMap.get(cond.columnId);
		if (!colConfig) {
			throw new FilterSqlError(
				"UNKNOWN_COLUMN",
				`Unknown column: "${cond.columnId}"`,
				{ columnId: cond.columnId },
			);
		}

		const validOperators =
			colConfig.operators ?? getOperatorsForType(colConfig.type);
		if (!validOperators.includes(cond.operator)) {
			throw new FilterSqlError(
				"INVALID_OPERATOR",
				`Invalid operator "${cond.operator}" for column "${cond.columnId}" (type: ${colConfig.type})`,
				{ columnId: cond.columnId, operator: cond.operator },
			);
		}

		const error = validateFilterValue(
			cond.operator,
			cond.value,
			colConfig.type,
		);
		if (error) {
			throw new FilterSqlError("INVALID_FILTER_VALUE", error, {
				columnId: cond.columnId,
				operator: cond.operator,
			});
		}
	}
}

type SqlBuilder = (col: string, value: unknown, ctx: BuildContext) => string;

function requirePostgresArray(ctx: BuildContext, operator: string): void {
	if (ctx.dialect !== "postgres") {
		throw new FilterSqlError(
			"UNSUPPORTED_DIALECT",
			`Operator "${operator}" needs Postgres text[] containment; no equivalent exists for dialect "${ctx.dialect}".`,
			{ dialect: ctx.dialect, operator },
		);
	}
}

function arrayPlaceholders(value: unknown, ctx: BuildContext): string {
	const arr = value as unknown[];
	return arr.map((v) => pushParam(ctx, v)).join(", ");
}

function arrayOp(
	col: string,
	value: unknown,
	ctx: BuildContext,
	op: "@>" | "&&",
	operator: FilterOperator,
): string {
	requirePostgresArray(ctx, operator);
	// Postgres text[] containment/overlap.
	return `${col} ${op} ARRAY[${arrayPlaceholders(value, ctx)}]::text[]`;
}

function notArrayOp(
	col: string,
	value: unknown,
	ctx: BuildContext,
	op: "@>" | "&&",
	operator: FilterOperator,
): string {
	return `NOT (${arrayOp(col, value, ctx, op, operator)})`;
}

function betweenOp(
	col: string,
	value: unknown,
	ctx: BuildContext,
	not: boolean,
): string {
	const [min, max] = value as [unknown, unknown];
	const keyword = not ? "NOT BETWEEN" : "BETWEEN";
	return `${col} ${keyword} ${pushParam(ctx, min)} AND ${pushParam(ctx, max)}`;
}

function likeOp(
	col: string,
	value: unknown,
	ctx: BuildContext,
	pattern: (v: string) => string,
	not: boolean,
): string {
	const param = pushParam(ctx, likePattern(value as string, pattern));
	if (ctx.dialect === "postgres" && !ctx.caseSensitive) {
		const keyword = not ? "NOT ILIKE" : "ILIKE";
		return `${col} ${keyword} ${param} ESCAPE '\\'`;
	}
	const keyword = not ? "NOT LIKE" : "LIKE";
	if (ctx.caseSensitive) return `${col} ${keyword} ${param} ESCAPE '\\'`;
	return `LOWER(${col}) ${keyword} LOWER(${param}) ESCAPE '\\'`;
}

function comparisonBuilder(op: string): SqlBuilder {
	return (col, value, ctx) => `${col} ${op} ${pushParam(ctx, value)}`;
}

const OPERATOR_SQL_BUILDERS: Record<FilterOperator, SqlBuilder> = {
	between: (col, value, ctx) => betweenOp(col, value, ctx, false),
	contains: (col, value, ctx) =>
		likeOp(col, value, ctx, (v) => `%${v}%`, false),
	endsWith: (col, value, ctx) => likeOp(col, value, ctx, (v) => `%${v}`, false),
	eq: comparisonBuilder("="),
	exclude: (col, value, ctx) => notArrayOp(col, value, ctx, "@>", "exclude"),
	excludeAll: (col, value, ctx) =>
		notArrayOp(col, value, ctx, "@>", "excludeAll"),
	excludeAny: (col, value, ctx) =>
		notArrayOp(col, value, ctx, "&&", "excludeAny"),
	gt: comparisonBuilder(">"),
	gte: comparisonBuilder(">="),
	in: (col, value, ctx) => {
		if (!Array.isArray(value) || value.length === 0) return "(1=0)";
		return `${col} IN (${arrayPlaceholders(value, ctx)})`;
	},
	include: (col, value, ctx) => arrayOp(col, value, ctx, "@>", "include"),
	includeAll: (col, value, ctx) => arrayOp(col, value, ctx, "@>", "includeAll"),
	includeAny: (col, value, ctx) => arrayOp(col, value, ctx, "&&", "includeAny"),
	isEmpty: (col) => `${col} IS NULL`,
	isNotEmpty: (col) => `${col} IS NOT NULL`,
	lt: comparisonBuilder("<"),
	lte: comparisonBuilder("<="),
	neq: comparisonBuilder("!="),
	notBetween: (col, value, ctx) => betweenOp(col, value, ctx, true),
	notContains: (col, value, ctx) =>
		likeOp(col, value, ctx, (v) => `%${v}%`, true),
	notIn: (col, value, ctx) => {
		if (!Array.isArray(value) || value.length === 0) return "(1=1)";
		return `${col} NOT IN (${arrayPlaceholders(value, ctx)})`;
	},
	startsWith: (col, value, ctx) =>
		likeOp(col, value, ctx, (v) => `${v}%`, false),
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
	if (isSearchColumn(condition.columnId)) {
		return buildSearchSql(
			condition.value as string,
			columnMapping,
			ctx,
			tableAlias,
		);
	}

	const columnName = columnMapping[condition.columnId];
	if (!columnName) {
		throw new FilterSqlError(
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

	const builder = OPERATOR_SQL_BUILDERS[condition.operator];
	if (!builder) {
		throw new FilterSqlError(
			"INVALID_OPERATOR",
			`Unhandled filter operator: ${condition.operator}`,
			{ columnId: condition.columnId, operator: condition.operator },
		);
	}

	return builder(col, condition.value, ctx);
}

function buildSearchSql(
	searchTerm: string,
	columnMapping: ColumnMapping,
	ctx: BuildContext,
	tableAlias: string | undefined,
): string {
	const searchableCols = [...ctx.columnMap.values()].filter(
		(c) => c.searchable && !isSearchColumn(c.id),
	);

	const conditions = searchableCols.map((colConfig) => {
		const columnName = columnMapping[colConfig.id];
		if (!columnName) {
			throw new FilterSqlError(
				"MISSING_MAPPING",
				`Missing column mapping for "${colConfig.id}"`,
				{ columnId: colConfig.id },
			);
		}
		const col = colRef(columnName, tableAlias, ctx.dialect);
		return likeOp(col, searchTerm, ctx, (v) => `%${v}%`, false);
	});

	if (conditions.length === 0) {
		throw new FilterSqlError(
			"NO_SEARCHABLE_COLUMN",
			"Search filter requires at least one searchable column",
		);
	}

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
		throw new FilterSqlError("EMPTY_GROUP", "Empty filter group");
	}
	if (sqls.length === 1) return sqls[0] as string;

	const joiner = group.combinator === "or" ? " OR " : " AND ";
	return `(${sqls.join(joiner)})`;
}

/**
 * Build a parameterized `WHERE` fragment.
 *
 * Always returns a result — empty filters yield `{ sql: "", params: [] }`
 * (no `undefined` branching at call sites). Params stream through a single
 * context via placeholders; pass `columnMap` when building many queries per
 * request to skip the per-call `Map` rebuild.
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
		columnMap: prebuilt,
		placeholderStyle = dialect === "postgres" ? "numbered" : "positional",
	} = options ?? {};
	const columnMap = resolveColumnMap(columnsConfig, prebuilt);
	validateConditions(conditions, columnMap);
	if (conditions.length === 0) return { params: [], sql: "" };

	const group = groupConditions(conditions);

	const ctx: BuildContext = {
		caseSensitive,
		columnMap,
		dialect,
		nextIdx: 1,
		params: [],
		placeholder: placeholderStyle,
	};

	const sql = buildGroupSql(group, columnMapping, ctx, tableAlias);

	return { params: [...ctx.params], sql };
}
