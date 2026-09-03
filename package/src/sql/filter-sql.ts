import { filterConditionSchema } from "../core/features/data-filtering/filter-condition-schema.ts";
import { groupConditions } from "../core/features/data-filtering/filter-grouping.ts";
import { validateOperatorValue } from "../core/features/data-filtering/filter-validation.ts";
import { getOperatorsForType } from "../core/features/data-filtering/operators.ts";
import type {
	ColumnConfig,
	FilterCondition,
	FilterGroup,
	FilterOperator,
} from "../core/types.ts";
import { SEARCH_COLUMN_ID } from "../core/types.ts";

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

		validateOperatorValue(cond.operator, cond.value, colConfig.type);
	}
}

type SqlBuilder = (col: string, value: unknown, ctx: BuildContext) => string;

function arrayPlaceholders(value: unknown, ctx: BuildContext): string {
	return (value as string[]).map((v) => pushParam(ctx, v)).join(", ");
}

function arrayOp(
	col: string,
	value: unknown,
	ctx: BuildContext,
	op: "@>" | "&&",
): string {
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
	const [min, max] = value as [number | string, number | string];
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
	return `${col} ${keyword} ${pushParam(ctx, pattern(value as string))}`;
}

const OPERATOR_SQL_BUILDERS: Record<FilterOperator, SqlBuilder> = {
	between: (col, value, ctx) => betweenOp(col, value, ctx, false),
	contains: (col, value, ctx) =>
		likeOp(col, value, ctx, (v) => `%${v}%`, false),
	endsWith: (col, value, ctx) => likeOp(col, value, ctx, (v) => `%${v}`, false),
	eq: (col, value, ctx) => `${col} = ${pushParam(ctx, value)}`,
	exclude: (col, value, ctx) => notArrayOp(col, value, ctx, "@>"),
	excludeAll: (col, value, ctx) => notArrayOp(col, value, ctx, "@>"),
	excludeAny: (col, value, ctx) => notArrayOp(col, value, ctx, "&&"),
	gt: (col, value, ctx) => `${col} > ${pushParam(ctx, value)}`,
	gte: (col, value, ctx) => `${col} >= ${pushParam(ctx, value)}`,
	in: (col, value, ctx) => `${col} IN (${arrayPlaceholders(value, ctx)})`,
	include: (col, value, ctx) => arrayOp(col, value, ctx, "@>"),
	includeAll: (col, value, ctx) => arrayOp(col, value, ctx, "@>"),
	includeAny: (col, value, ctx) => arrayOp(col, value, ctx, "&&"),
	isEmpty: (col) => `${col} IS NULL`,
	isNotEmpty: (col) => `${col} IS NOT NULL`,
	lt: (col, value, ctx) => `${col} < ${pushParam(ctx, value)}`,
	lte: (col, value, ctx) => `${col} <= ${pushParam(ctx, value)}`,
	neq: (col, value, ctx) => `${col} != ${pushParam(ctx, value)}`,
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
): string | undefined {
	const colConfig = columnsConfig.find((c) => c.id === condition.columnId);
	if (!colConfig) return undefined;

	if (condition.columnId === SEARCH_COLUMN_ID) {
		return buildSearchSql(
			condition.value as string,
			columnMapping,
			columnsConfig,
			ctx,
			tableAlias,
		);
	}

	const columnName = columnMapping[condition.columnId];
	if (!columnName) return undefined;

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
		(c) => c.searchable && c.id !== SEARCH_COLUMN_ID,
	);

	const conditions = searchableCols.flatMap((colConfig) => {
		const columnName = columnMapping[colConfig.id];
		if (!columnName) return [];
		const col = colRef(columnName, tableAlias);
		return [`${col} ILIKE ${pushParam(ctx, `%${searchTerm}%`)}`];
	});

	if (conditions.length === 0) {
		return "1 = 0";
	}

	if (conditions.length === 1) {
		return conditions[0] as string;
	}

	return `(${conditions.join(" OR ")})`;
}

function buildGroupSql(
	group: FilterGroup,
	columnMapping: ColumnMapping,
	columnsConfig: ColumnConfig[],
	ctx: BuildContext,
	tableAlias: string | undefined,
): string | undefined {
	const sqls: string[] = [];

	for (const item of group.conditions) {
		const sub =
			"conditions" in item
				? buildGroupSql(item, columnMapping, columnsConfig, ctx, tableAlias)
				: buildConditionSql(
						item,
						columnMapping,
						columnsConfig,
						ctx,
						tableAlias,
					);
		if (sub) sqls.push(sub);
	}

	if (sqls.length === 0) return undefined;
	if (sqls.length === 1) return sqls[0];

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

	if (!sql) return undefined;

	return { params: [...ctx.params], sql };
}
