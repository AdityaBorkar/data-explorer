import { and, or, type SQL, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";

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

function getColumnName(table: PgTable, columnId: string): string | undefined {
  const column = (table as unknown as Record<string, { name: string }>)[
    columnId
  ];
  return column?.name;
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

function ident(name: string): SQL {
  return sql`${sql.identifier(name)}`;
}

type SqlBuilder = (col: SQL, value: unknown) => SQL;

const OPERATOR_SQL_BUILDERS: Record<FilterOperator, SqlBuilder> = {
  between: (col, value) => {
    const [min, max] = value as [number | string, number | string];
    return sql`${col} BETWEEN ${min} AND ${max}`;
  },
  contains: (col, value) => sql`${col} ILIKE ${`%${value as string}%`}`,
  endsWith: (col, value) => sql`${col} ILIKE ${`%${value as string}`}`,
  eq: (col, value) => sql`${col} = ${value}`,
  exclude: (col, value) => sql`NOT (${col} @> ARRAY[${value}]::text[])`,
  excludeAll: (col, value) => sql`NOT (${col} @> ARRAY[${value}]::text[])`,
  excludeAny: (col, value) => sql`NOT (${col} && ARRAY[${value}]::text[])`,
  gt: (col, value) => sql`${col} > ${value}`,
  gte: (col, value) => sql`${col} >= ${value}`,
  in: (col, value) => {
    const vals = value as string[];
    return sql`${col} IN (${sql.join(
      vals.map((v) => sql`${v}`),
      sql`, `,
    )})`;
  },
  include: (col, value) => sql`${col} @> ARRAY[${value}]::text[]`,
  includeAll: (col, value) => sql`${col} @> ARRAY[${value}]::text[]`,
  includeAny: (col, value) => sql`${col} && ARRAY[${value}]::text[]`,
  isEmpty: (col) => sql`${col} IS NULL`,
  isNotEmpty: (col) => sql`${col} IS NOT NULL`,
  lt: (col, value) => sql`${col} < ${value}`,
  lte: (col, value) => sql`${col} <= ${value}`,
  neq: (col, value) => sql`${col} != ${value}`,
  notBetween: (col, value) => {
    const [min, max] = value as [number | string, number | string];
    return sql`${col} NOT BETWEEN ${min} AND ${max}`;
  },
  notContains: (col, value) => sql`${col} NOT ILIKE ${`%${value as string}%`}`,
  notIn: (col, value) => {
    const vals = value as string[];
    return sql`${col} NOT IN (${sql.join(
      vals.map((v) => sql`${v}`),
      sql`, `,
    )})`;
  },
  startsWith: (col, value) => sql`${col} ILIKE ${`${value as string}%`}`,
};

function buildConditionSql(
  condition: FilterCondition,
  table: PgTable,
  columnsConfig: ColumnConfig[],
): SQL | undefined {
  const colConfig = columnsConfig.find((c) => c.id === condition.columnId);
  if (!colConfig) return;

  if (condition.columnId === SEARCH_COLUMN_ID) {
    return buildSearchSql(condition.value as string, table, columnsConfig);
  }

  const colName = getColumnName(table, condition.columnId);
  if (!colName) return;

  const col = ident(colName);
  const builder = OPERATOR_SQL_BUILDERS[condition.operator as FilterOperator];
  if (!builder) {
    throw new Error(`Unhandled filter operator: ${condition.operator}`);
  }

  return builder(col, condition.value);
}

function buildSearchSql(
  searchTerm: string,
  table: PgTable,
  columnsConfig: ColumnConfig[],
): SQL {
  const searchableCols = columnsConfig.filter(
    (c) => c.searchable && c.id !== SEARCH_COLUMN_ID,
  );

  const conditions = searchableCols
    .map((colConfig) => {
      const colName = getColumnName(table, colConfig.id);
      if (!colName) return "";
      return sql`${ident(colName)} ILIKE ${`%${searchTerm}%`}`;
    })
    .filter((c): c is SQL => c !== undefined);

  if (conditions.length === 0) {
    return sql`1 = 0`;
  }

  if (conditions.length === 1) {
    return conditions[0] ?? sql`1 = 0`;
  }

  return or(...conditions) ?? sql`1 = 0`;
}

function buildGroupSql(
  group: FilterGroup,
  table: PgTable,
  columnsConfig: ColumnConfig[],
): SQL | undefined {
  const sqls: SQL[] = [];

  for (const item of group.conditions) {
    if ("conditions" in item) {
      const subSql = buildGroupSql(item as FilterGroup, table, columnsConfig);
      if (subSql) sqls.push(subSql);
    } else {
      const condSql = buildConditionSql(
        item as FilterCondition,
        table,
        columnsConfig,
      );
      if (condSql) sqls.push(condSql);
    }
  }

  if (sqls.length === 0) return;
  if (sqls.length === 1) return sqls[0];

  if (group.combinator === "or") {
    return or(...sqls);
  }

  return and(...sqls);
}

export function buildFilterWhere(
  conditions: FilterCondition[],
  columnsConfig: ColumnConfig[],
  schema: PgTable,
): SQL | undefined {
  const validated = validateConditions(conditions, columnsConfig);
  if (validated.length === 0) return;

  const group = groupConditions(validated);
  return buildGroupSql(group, schema, columnsConfig);
}
