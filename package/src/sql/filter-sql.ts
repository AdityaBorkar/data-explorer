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

import type { DataExplorerErrorCode } from "../errors.ts";
import { DataExplorerError } from "../errors.ts";
import { makeFilterConditionSchema } from "../features/data-filtering/filter-condition-schema.ts";
import { groupConditions } from "../features/data-filtering/filter-grouping.ts";
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

function postgresDialect(caseSensitive: boolean): DialectImpl {
	return {
		assertArraySupported: () => {},
		buildLike: (col, param, not) => {
			if (!caseSensitive) {
				const keyword = not ? "NOT ILIKE" : "ILIKE";
				return `${col} ${keyword} ${param} ESCAPE '\\'`;
			}
			const keyword = not ? "NOT LIKE" : "LIKE";
			return `${col} ${keyword} ${param} ESCAPE '\\'`;
		},
		quoteIdent: ansiQuote,
	};
}

function genericDialect(
	dialect: SqlDialect,
	caseSensitive: boolean,
	quote: (name: string) => string,
): DialectImpl {
	return {
		assertArraySupported: (operator) => {
			throw new DataExplorerError(
				"UNSUPPORTED_DIALECT",
				`Operator "${operator}" needs Postgres text[] containment; no equivalent exists for dialect "${dialect}".`,
				{ dialect, operator },
			);
		},
		buildLike: (col, param, not) => {
			const keyword = not ? "NOT LIKE" : "LIKE";
			if (caseSensitive) return `${col} ${keyword} ${param} ESCAPE '\\'`;
			return `LOWER(${col}) ${keyword} LOWER(${param}) ESCAPE '\\'`;
		},
		quoteIdent: quote,
	};
}

function resolveDialect(
	dialect: SqlDialect,
	caseSensitive: boolean,
): DialectImpl {
	if (dialect === "postgres") return postgresDialect(caseSensitive);
	if (dialect === "mysql") {
		return genericDialect(
			dialect,
			caseSensitive,
			(name) => `\`${name.replace(/`/g, "``")}\``,
		);
	}
	return genericDialect(dialect, caseSensitive, ansiQuote);
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
 * Single validation entry point: delegates to the column-aware zod
 * schema (the same contract form-level callers use) and maps the first
 * issue to a matchable `DataExplorerError` code.
 */
function validateConditions(
	conditions: FilterCondition[],
	columnMap: Map<string, ColumnConfig>,
): void {
	const schema = makeFilterConditionSchema([...columnMap.values()]);
	for (const cond of conditions) {
		const parsed = schema.safeParse(cond);
		if (parsed.success) continue;
		const message =
			parsed.error.issues[0]?.message ?? "Invalid filter condition";
		const code: DataExplorerErrorCode =
			message === "Unknown column"
				? "UNKNOWN_COLUMN"
				: message.startsWith("Invalid operator")
					? "INVALID_OPERATOR"
					: "INVALID_FILTER_VALUE";
		throw new DataExplorerError(code, `Invalid filter condition: ${message}`, {
			columnId: cond.columnId,
			...(code === "UNKNOWN_COLUMN" ? {} : { operator: cond.operator }),
		});
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
	Exclude<FilterOperator, "isEmpty" | "isNotEmpty">,
	SqlBuilder
> = {
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

	const builder = OPERATOR_SQL_BUILDERS[condition.operator];
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

	const conditions = searchableCols.map((colConfig) => {
		const columnName = columnMapping[colConfig.id];
		if (!columnName) {
			throw new DataExplorerError(
				"MISSING_MAPPING",
				`Missing column mapping for "${colConfig.id}"`,
				{ columnId: colConfig.id },
			);
		}
		const col = colRef(columnName, tableAlias, ctx.impl);
		return likeOp(col, searchTerm, ctx, (v) => `%${v}%`, false);
	});

	if (conditions.length === 0) {
		throw new DataExplorerError(
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
