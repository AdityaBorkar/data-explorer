import type { ColumnConfig } from "../columns.ts";
import type { FilterCondition } from "../filters.ts";
import type { ColumnMapping, ParameterizedSql } from "./index.ts";
import { buildFilterWhere } from "./index.ts";

export interface BuildPgWhereOptions {
	/** `true` → binary `LIKE`; default `false` → `ILIKE`. Only pg semantic kept. */
	caseSensitive?: boolean;
	tableAlias?: string;
}

/**
 * Postgres-only `buildFilterWhere`: `$n` numbered placeholders, always.
 *
 * Wrapper (not fork) over the shared builder, so parity with the root
 * `buildFilterWhere({ dialect: "postgres" })` is structural; the
 * `./pg-where.test.ts` matrix locks it test-by-test.
 */
export function buildFilterWherePg(
	conditions: FilterCondition[],
	columnsConfig: ColumnConfig[],
	columnMapping: ColumnMapping,
	options?: BuildPgWhereOptions,
): ParameterizedSql {
	return buildFilterWhere(conditions, columnsConfig, columnMapping, {
		caseSensitive: options?.caseSensitive ?? false,
		dialect: "postgres",
		placeholderStyle: "numbered",
		tableAlias: options?.tableAlias,
	});
}
