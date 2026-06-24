import { filterConditionSchema } from "../core/filter/filter-condition-schema.ts";
import { groupConditions } from "../core/filter/filter-grouping.ts";
import { validateOperatorValue } from "../core/filter/filter-validation.ts";
import { getOperatorsForType } from "../core/filter/operators.ts";
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
  if (ctx.placeholder === "positional") {
    return "?";
  }
  return `$${ctx.nextIdx++ + 1}`;
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
): FilterCondition[] {
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
    if (!validOperators.includes(cond.operator as FilterOperator)) {
      throw new Error(
        `Invalid operator "${cond.operator}" for column "${cond.columnId}" (type: ${colConfig.type})`,
      );
    }

    validateOperatorValue(
      cond.operator as FilterOperator,
      cond.value,
      colConfig.type,
    );
  }

  return conditions;
}

type SqlBuilder = (col: string, value: unknown, ctx: BuildContext) => string;

function arrayPlaceholders(vals: string[], ctx: BuildContext): string {
  return vals.map((v) => pushParam(ctx, v)).join(", ");
}

const OPERATOR_SQL_BUILDERS: Record<FilterOperator, SqlBuilder> = {
  between: (col, value, ctx) => {
    const [min, max] = value as [number | string, number | string];
    return `${col} BETWEEN ${pushParam(ctx, min)} AND ${pushParam(ctx, max)}`;
  },
  contains: (col, value, ctx) =>
    `${col} ILIKE ${pushParam(ctx, `%${value as string}%`)}`,
  endsWith: (col, value, ctx) =>
    `${col} ILIKE ${pushParam(ctx, `%${value as string}`)}`,
  eq: (col, value, ctx) => `${col} = ${pushParam(ctx, value)}`,
  exclude: (col, value, ctx) =>
    `NOT (${col} @> ARRAY[${arrayPlaceholders(value as string[], ctx)}]::text[])`,
  excludeAll: (col, value, ctx) =>
    `NOT (${col} @> ARRAY[${arrayPlaceholders(value as string[], ctx)}]::text[])`,
  excludeAny: (col, value, ctx) =>
    `NOT (${col} && ARRAY[${arrayPlaceholders(value as string[], ctx)}]::text[])`,
  gt: (col, value, ctx) => `${col} > ${pushParam(ctx, value)}`,
  gte: (col, value, ctx) => `${col} >= ${pushParam(ctx, value)}`,
  in: (col, value, ctx) =>
    `${col} IN (${arrayPlaceholders(value as string[], ctx)})`,
  include: (col, value, ctx) =>
    `${col} @> ARRAY[${arrayPlaceholders(value as string[], ctx)}]::text[]`,
  includeAll: (col, value, ctx) =>
    `${col} @> ARRAY[${arrayPlaceholders(value as string[], ctx)}]::text[]`,
  includeAny: (col, value, ctx) =>
    `${col} && ARRAY[${arrayPlaceholders(value as string[], ctx)}]::text[]`,
  isEmpty: (col) => `${col} IS NULL`,
  isNotEmpty: (col) => `${col} IS NOT NULL`,
  lt: (col, value, ctx) => `${col} < ${pushParam(ctx, value)}`,
  lte: (col, value, ctx) => `${col} <= ${pushParam(ctx, value)}`,
  neq: (col, value, ctx) => `${col} != ${pushParam(ctx, value)}`,
  notBetween: (col, value, ctx) => {
    const [min, max] = value as [number | string, number | string];
    return `${col} NOT BETWEEN ${pushParam(ctx, min)} AND ${pushParam(ctx, max)}`;
  },
  notContains: (col, value, ctx) =>
    `${col} NOT ILIKE ${pushParam(ctx, `%${value as string}%`)}`,
  notIn: (col, value, ctx) =>
    `${col} NOT IN (${arrayPlaceholders(value as string[], ctx)})`,
  startsWith: (col, value, ctx) =>
    `${col} ILIKE ${pushParam(ctx, `${value as string}%`)}`,
};

function buildConditionSql(
  condition: FilterCondition,
  columnMapping: ColumnMapping,
  columnsConfig: ColumnConfig[],
  ctx: BuildContext,
  tableAlias: string | undefined,
): string | undefined {
  const colConfig = columnsConfig.find((c) => c.id === condition.columnId);
  if (!colConfig) return;

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
  if (!columnName) return;

  const col = colRef(columnName, tableAlias);
  const builder = OPERATOR_SQL_BUILDERS[condition.operator as FilterOperator];
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

  const conditions = searchableCols
    .map((colConfig) => {
      const columnName = columnMapping[colConfig.id];
      if (!columnName) return undefined;
      const col = colRef(columnName, tableAlias);
      return `${col} ILIKE ${pushParam(ctx, `%${searchTerm}%`)}`;
    })
    .filter((c): c is string => c !== undefined);

  if (conditions.length === 0) {
    return "1 = 0";
  }

  if (conditions.length === 1) {
    return conditions[0] ?? "1 = 0";
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
    if ("conditions" in item) {
      const subSql = buildGroupSql(
        item as FilterGroup,
        columnMapping,
        columnsConfig,
        ctx,
        tableAlias,
      );
      if (subSql) sqls.push(subSql);
    } else {
      const condSql = buildConditionSql(
        item as FilterCondition,
        columnMapping,
        columnsConfig,
        ctx,
        tableAlias,
      );
      if (condSql) sqls.push(condSql);
    }
  }

  if (sqls.length === 0) return;
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
  const validated = validateConditions(conditions, columnsConfig);
  if (validated.length === 0) return;

  const group = groupConditions(validated);

  const ctx: BuildContext = {
    nextIdx: 0,
    params: [],
    placeholder: options?.placeholderStyle ?? "numbered",
  };

  const sql = buildGroupSql(
    group,
    columnMapping,
    columnsConfig,
    ctx,
    options?.tableAlias,
  );

  if (!sql) return;

  return { params: ctx.params, sql };
}
