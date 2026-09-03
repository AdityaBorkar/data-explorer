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

export type PlaceholderStyle = "numbered" | "positional";

export interface BuildFilterOptions {
	placeholderStyle?: PlaceholderStyle;
	tableAlias?: string;
}

interface BuildContext {
	nextIdx: number;
	params: unknown[];
	placeholder: PlaceholderStyle;
}

function pushParam(ctx: BuildContext, value: unknown): string {
	ctx.params.push(value);
	return ctx.placeholder === "positional" ? "?" : `$${ctx.nextIdx++}`;
}

function quoteIdent(name: string): string {
	return `"${name.replace(/"/g, '""')}"`;
}

function colRef(columnName: string, tableAlias: string | undefined): string {
	const quoted = quoteIdent(columnName);
	return tableAlias ? `${quoteIdent(tableAlias)}.${quoted}` : quoted;
}

/** Escape LIKE wildcards so user input matches literally. */
function escapeLikePattern(value: string): string {
	return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function likePattern(value: string, wrap: (v: string) => string): string {
	return wrap(escapeLikePattern(value));
}

function validateConditions(
	conditions: FilterCondition[],
	columnsConfig: ColumnConfig[],
): void {
	const columnMap = new Map(columnsConfig.map((c) => [c.id, c]));

	for (const cond of conditions) {
		const parsed = filterConditionSchema.safeParse(cond);
		if (!parsed.success) {
			throw new Error(`Invalid filter condition: ${parsed.error.message}`);
		}

		if (isSearchColumn(cond.columnId)) {
			if (cond.operator !== "contains") {
				throw new Error(`Invalid operator "${cond.operator}" for search`);
			}
			if (typeof cond.value !== "string" || cond.value.length === 0) {
				throw new Error(`Search filter requires a non-empty string value`);
			}
			continue;
		}

		const colConfig = columnMap.get(cond.columnId);
		if (!colConfig) {
			throw new Error(`Unknown column: ${cond.columnId}`);
		}

		const validOperators =
			colConfig.operators ?? getOperatorsForType(colConfig.type);
		if (!validOperators.includes(cond.operator)) {
			throw new Error(
				`Invalid operator "${cond.operator}" for column "${cond.columnId}" (type: ${colConfig.type})`,
			);
		}

		const error = validateFilterValue(
			cond.operator,
			cond.value,
			colConfig.type,
		);
		if (error) throw new Error(error);
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
): string {
	// Postgres text[] containment/overlap.
	return `${col} ${op} ARRAY[${arrayPlaceholders(value, ctx)}]::text[]`;
}

function notArrayOp(
	col: string,
	value: unknown,
	ctx: BuildContext,
	op: "@>" | "&&",
): string {
	return `NOT (${arrayOp(col, value, ctx, op)})`;
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
	const keyword = not ? "NOT ILIKE" : "ILIKE";
	return `${col} ${keyword} ${pushParam(ctx, likePattern(value as string, pattern))} ESCAPE '\\'`;
}

const COMPARISON_OPS: Record<string, string> = {
	eq: "=",
	gt: ">",
	gte: ">=",
	lt: "<",
	lte: "<=",
	neq: "!=",
};

const ARRAY_OPS: Record<string, "@>" | "&&"> = {
	exclude: "@>",
	excludeAll: "@>",
	excludeAny: "&&",
	include: "@>",
	includeAll: "@>",
	includeAny: "&&",
};

function comparisonBuilder(op: string): SqlBuilder {
	return (col, value, ctx) => `${col} ${op} ${pushParam(ctx, value)}`;
}

const OPERATOR_SQL_BUILDERS: Record<FilterOperator, SqlBuilder> = {
	between: (col, value, ctx) => betweenOp(col, value, ctx, false),
	contains: (col, value, ctx) =>
		likeOp(col, value, ctx, (v) => `%${v}%`, false),
	endsWith: (col, value, ctx) => likeOp(col, value, ctx, (v) => `%${v}`, false),
	eq: comparisonBuilder(COMPARISON_OPS["eq"] as string),
	exclude: (col, value, ctx) =>
		notArrayOp(col, value, ctx, ARRAY_OPS["exclude"] as "@>"),
	excludeAll: (col, value, ctx) =>
		notArrayOp(col, value, ctx, ARRAY_OPS["excludeAll"] as "@>"),
	excludeAny: (col, value, ctx) =>
		notArrayOp(col, value, ctx, ARRAY_OPS["excludeAny"] as "&&"),
	gt: comparisonBuilder(COMPARISON_OPS["gt"] as string),
	gte: comparisonBuilder(COMPARISON_OPS["gte"] as string),
	in: (col, value, ctx) => `${col} IN (${arrayPlaceholders(value, ctx)})`,
	include: (col, value, ctx) =>
		arrayOp(col, value, ctx, ARRAY_OPS["include"] as "@>"),
	includeAll: (col, value, ctx) =>
		arrayOp(col, value, ctx, ARRAY_OPS["includeAll"] as "@>"),
	includeAny: (col, value, ctx) =>
		arrayOp(col, value, ctx, ARRAY_OPS["includeAny"] as "&&"),
	isEmpty: (col) => `${col} IS NULL`,
	isNotEmpty: (col) => `${col} IS NOT NULL`,
	lt: comparisonBuilder(COMPARISON_OPS["lt"] as string),
	lte: comparisonBuilder(COMPARISON_OPS["lte"] as string),
	neq: comparisonBuilder(COMPARISON_OPS["neq"] as string),
	notBetween: (col, value, ctx) => betweenOp(col, value, ctx, true),
	notContains: (col, value, ctx) =>
		likeOp(col, value, ctx, (v) => `%${v}%`, true),
	notIn: (col, value, ctx) =>
		`${col} NOT IN (${arrayPlaceholders(value, ctx)})`,
	startsWith: (col, value, ctx) =>
		likeOp(col, value, ctx, (v) => `${v}%`, false),
};

function buildConditionSql(
	condition: FilterCondition,
	columnMapping: ColumnMapping,
	columnsConfig: ColumnConfig[],
	ctx: BuildContext,
	tableAlias: string | undefined,
): string {
	if (isSearchColumn(condition.columnId)) {
		return buildSearchSql(
			condition.value as string,
			columnMapping,
			columnsConfig,
			ctx,
			tableAlias,
		);
	}

	const columnName = columnMapping[condition.columnId];
	if (!columnName) {
		throw new Error(`Missing column mapping for "${condition.columnId}"`);
	}

	const col = colRef(columnName, tableAlias);
	const builder = OPERATOR_SQL_BUILDERS[condition.operator];
	if (!builder) {
		throw new Error(`Unhandled filter operator: ${condition.operator}`);
	}

	return builder(col, condition.value, ctx);
}

function buildSearchSql(
	searchTerm: string,
	columnMapping: ColumnMapping,
	columnsConfig: ColumnConfig[],
	ctx: BuildContext,
	tableAlias: string | undefined,
): string {
	const searchableCols = columnsConfig.filter(
		(c) => c.searchable && !isSearchColumn(c.id),
	);

	const conditions = searchableCols.map((colConfig) => {
		const columnName = columnMapping[colConfig.id];
		if (!columnName) {
			throw new Error(`Missing column mapping for "${colConfig.id}"`);
		}
		const col = colRef(columnName, tableAlias);
		return `${col} ILIKE ${pushParam(
			ctx,
			likePattern(searchTerm, (v) => `%${v}%`),
		)} ESCAPE '\\'`;
	});

	if (conditions.length === 0) {
		throw new Error(`Search filter requires at least one searchable column`);
	}

	return conditions.length === 1
		? (conditions[0] as string)
		: `(${conditions.join(" OR ")})`;
}

function buildGroupSql(
	group: FilterGroup,
	columnMapping: ColumnMapping,
	columnsConfig: ColumnConfig[],
	ctx: BuildContext,
	tableAlias: string | undefined,
): string {
	const sqls: string[] = [];

	for (const item of group.conditions) {
		const sub = isFilterGroup(item)
			? buildGroupSql(item, columnMapping, columnsConfig, ctx, tableAlias)
			: buildConditionSql(item, columnMapping, columnsConfig, ctx, tableAlias);
		sqls.push(sub);
	}

	if (sqls.length === 0) throw new Error(`Empty filter group`);
	if (sqls.length === 1) return sqls[0] as string;

	const joiner = group.combinator === "or" ? " OR " : " AND ";
	return `(${sqls.join(joiner)})`;
}

export function buildFilterWhere(
	conditions: FilterCondition[],
	columnsConfig: ColumnConfig[],
	columnMapping: ColumnMapping,
	options?: BuildFilterOptions,
): ParameterizedSql | undefined {
	validateConditions(conditions, columnsConfig);
	if (conditions.length === 0) return undefined;

	const group = groupConditions(conditions);
	const { placeholderStyle = "numbered", tableAlias } = options ?? {};

	const ctx: BuildContext = {
		nextIdx: 1,
		params: [],
		placeholder: placeholderStyle,
	};

	const sql = buildGroupSql(
		group,
		columnMapping,
		columnsConfig,
		ctx,
		tableAlias,
	);

	return { params: [...ctx.params], sql };
}
