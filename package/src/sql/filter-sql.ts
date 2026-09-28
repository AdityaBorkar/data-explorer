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

import { DataExplorerError } from "../errors.ts";
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
	/** @default "postgres" */
	dialect?: SqlDialect;
	/**
	 * Placeholder rendering. Defaults per dialect (`numbered` for postgres,
	 * `positional` for sqlite/mysql) — pass explicitly for cross-dialect codegen.
	 */
	placeholderStyle?: PlaceholderStyle;
	tableAlias?: string;
}

interface DialectImpl {
	assertArraySupported: (operator: string) => void;
	buildLike: (col: string, param: string, not: boolean) => string;
	quoteIdent: (name: string) => string;
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

function buildLikeFrag(
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

function resolveDialect(
	dialect: SqlDialect,
	caseSensitive: boolean,
): DialectImpl {
	return {
		assertArraySupported: (operator) => assertArraySupported(operator, dialect),
		buildLike: (col, param, not) =>
			buildLikeFrag(col, param, not, dialect, caseSensitive),
		quoteIdent: (name) => quoteIdent(name, dialect),
	};
}

interface BuildContext {
	columnMap: Map<string, ColumnConfig>;
	impl: DialectImpl;
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
	impl: DialectImpl,
): string {
	const quoted = impl.quoteIdent(columnName);
	return tableAlias ? `${impl.quoteIdent(tableAlias)}.${quoted}` : quoted;
}

/** Escape LIKE wildcards so user input matches literally. */
function escapeLikePattern(value: string): string {
	return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/**
 * Historical aliases, canonicalized once before SQL generation so the
 * operator table only carries the canonical names. Accepted everywhere
 * (stored filters, zod schema) but never branched on downstream.
 */
const OPERATOR_ALIASES: Partial<Record<FilterOperator, FilterOperator>> = {
	exclude: "excludeAll",
	include: "includeAll",
};

function canonicalOperator(operator: FilterOperator): FilterOperator {
	return OPERATOR_ALIASES[operator] ?? operator;
}

/**
 * Single validation entry point with explicit matchable codes.
 * Mirrors the column-aware zod schema (`makeFilterConditionSchema`, the
 * contract form-level callers use) but branches on structure — never on
 * zod message text — so copy edits to messages can't re-code SQL errors.
 */
function validateConditions(
	conditions: FilterCondition[],
	columnMap: Map<string, ColumnConfig>,
): void {
	for (const cond of conditions) {
		if (isSearchColumn(cond.columnId)) {
			if (cond.operator !== "contains") {
				throw new DataExplorerError(
					"INVALID_OPERATOR",
					`Invalid operator "${cond.operator}" for search (must be "contains")`,
					{ columnId: cond.columnId, operator: cond.operator },
				);
			}
			if (typeof cond.value !== "string" || cond.value.length === 0) {
				throw new DataExplorerError(
					"INVALID_FILTER_VALUE",
					"Search filter requires a non-empty string value",
					{ columnId: cond.columnId, operator: cond.operator },
				);
			}
			continue;
		}
		const col = columnMap.get(cond.columnId);
		if (!col) {
			throw new DataExplorerError(
				"UNKNOWN_COLUMN",
				`Invalid filter condition: Unknown column "${cond.columnId}"`,
				{ columnId: cond.columnId },
			);
		}
		const valid = col.operators ?? getOperatorsForType(col.type);
		if (
			!valid.includes(canonicalOperator(cond.operator)) &&
			!valid.includes(cond.operator)
		) {
			throw new DataExplorerError(
				"INVALID_OPERATOR",
				`Invalid filter condition: Invalid operator "${cond.operator}" for column "${cond.columnId}"`,
				{ columnId: cond.columnId, operator: cond.operator },
			);
		}
		const error = validateFilterValue(
			canonicalOperator(cond.operator),
			cond.value,
			col.type,
		);
		if (error) {
			throw new DataExplorerError(
				"INVALID_FILTER_VALUE",
				`Invalid filter condition: ${error}`,
				{ columnId: cond.columnId, operator: cond.operator },
			);
		}
	}
}

type SqlBuilder = (col: string, value: unknown, ctx: BuildContext) => string;

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
	ctx.impl.assertArraySupported(operator);
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
	const param = pushParam(ctx, pattern(escapeLikePattern(value as string)));
	return ctx.impl.buildLike(col, param, not);
}

function comparisonBuilder(op: string): SqlBuilder {
	return (col, value, ctx) => `${col} ${op} ${pushParam(ctx, value)}`;
}

const OPERATOR_SQL_BUILDERS: Record<
	Exclude<FilterOperator, "isEmpty" | "isNotEmpty" | "include" | "exclude">,
	SqlBuilder
> = {
	between: (col, value, ctx) => betweenOp(col, value, ctx, false),
	contains: (col, value, ctx) =>
		likeOp(col, value, ctx, (v) => `%${v}%`, false),
	endsWith: (col, value, ctx) => likeOp(col, value, ctx, (v) => `%${v}`, false),
	eq: comparisonBuilder("="),
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
	includeAll: (col, value, ctx) => arrayOp(col, value, ctx, "@>", "includeAll"),
	includeAny: (col, value, ctx) => arrayOp(col, value, ctx, "&&", "includeAny"),
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
		throw new DataExplorerError(
			"MISSING_MAPPING",
			`Missing column mapping for "${condition.columnId}"`,
			{ columnId: condition.columnId },
		);
	}

	const col = colRef(columnName, tableAlias, ctx.impl);

	if (condition.operator === "isEmpty" || condition.operator === "isNotEmpty") {
		const type = ctx.columnMap.get(condition.columnId)?.type;
		if (condition.operator === "isEmpty") return isEmptySql(col, type);
		return type === "string"
			? `(${col} IS NOT NULL AND ${col} != '')`
			: `${col} IS NOT NULL`;
	}

	const canonical = canonicalOperator(condition.operator);
	const builder: SqlBuilder | undefined = (
		OPERATOR_SQL_BUILDERS as Partial<Record<FilterOperator, SqlBuilder>>
	)[canonical];
	if (!builder) {
		throw new DataExplorerError(
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
		columnMap,
		impl: resolveDialect(dialect, caseSensitive),
		nextIdx: 1,
		params: [],
		placeholderStyle,
	};

	const sql = buildGroupSql(group, columnMapping, ctx, tableAlias);

	return { params: [...ctx.params], sql };
}
