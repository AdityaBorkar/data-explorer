import { describe, expect, it } from "vitest";

import type { ColumnConfig } from "../columns.ts";
import type { FilterCondition, FilterOperator } from "../filters.ts";
import {
	buildFilterWherePg,
	createSearchFilter,
	DataExplorerError,
	FILTER_OPERATORS,
	SEARCH_COLUMN_ID,
} from "./backend.ts";
import { buildFilterWhere } from "./index.ts";

const COLUMNS: ColumnConfig[] = [
	{ displayName: "Title", id: "title", searchable: true, type: "string" },
	{ displayName: "Status", id: "status", searchable: true, type: "enum" },
	{ displayName: "Estimate", id: "estimate", type: "number" },
	{ displayName: "Tags", id: "tags", type: "multiEnum" },
	// Known to the column config but absent from the mapping (MISSING_MAPPING fixture).
	{ displayName: "Notes", id: "notes", type: "string" },
];

const MAPPING = {
	estimate: "estimate",
	status: "status",
	tags: "tags",
	title: "title",
};

function cond(
	columnId: string,
	operator: FilterOperator,
	value: unknown,
	combinator: "and" | "or" = "and",
): FilterCondition {
	return {
		columnId,
		combinator,
		id: `${columnId}-${operator}`,
		operator,
		value,
	};
}

interface OperatorCase {
	columnId: string;
	operator: FilterOperator;
	value: unknown;
}

/** One case per canonical operator (+ text/non-text nullary variants). */
const OPERATOR_CASES: readonly OperatorCase[] = [
	{ columnId: "estimate", operator: "between", value: [1, 10] },
	{ columnId: "title", operator: "contains", value: "pol" },
	{ columnId: "title", operator: "endsWith", value: "ish" },
	{ columnId: "title", operator: "eq", value: "polish" },
	{ columnId: "tags", operator: "excludeAll", value: ["a", "b"] },
	{ columnId: "tags", operator: "excludeAny", value: ["a"] },
	{ columnId: "estimate", operator: "gt", value: 3 },
	{ columnId: "estimate", operator: "gte", value: 3 },
	{ columnId: "status", operator: "in", value: ["todo", "done"] },
	{ columnId: "tags", operator: "includeAll", value: ["a", "b"] },
	{ columnId: "tags", operator: "includeAny", value: ["a"] },
	{ columnId: "title", operator: "isEmpty", value: null },
	{ columnId: "estimate", operator: "isEmpty", value: null },
	{ columnId: "title", operator: "isNotEmpty", value: null },
	{ columnId: "estimate", operator: "isNotEmpty", value: null },
	{ columnId: "estimate", operator: "lt", value: 8 },
	{ columnId: "estimate", operator: "lte", value: 8 },
	{ columnId: "status", operator: "neq", value: "blocked" },
	{ columnId: "estimate", operator: "notBetween", value: [1, 10] },
	{ columnId: "title", operator: "notContains", value: "pol" },
	{ columnId: "status", operator: "notIn", value: ["done"] },
	{ columnId: "title", operator: "startsWith", value: "pol" },
];

/** Deep-equal parity oracle: backend output must match root postgres byte-for-byte. */
function expectPgParity(
	conditions: FilterCondition[],
	columnsConfig: ColumnConfig[] = COLUMNS,
	options?: { caseSensitive?: boolean; tableAlias?: string },
): { params: unknown[]; sql: string } {
	const pg = buildFilterWherePg(conditions, columnsConfig, MAPPING, options);
	const root = buildFilterWhere(conditions, columnsConfig, MAPPING, {
		caseSensitive: options?.caseSensitive,
		dialect: "postgres",
		placeholderStyle: "numbered",
		tableAlias: options?.tableAlias,
	});
	expect(pg).toEqual(root);
	return pg;
}

describe("buildFilterWherePg parity with root postgres", () => {
	it("matches root buildFilterWhere for every operator in the matrix", () => {
		for (const c of OPERATOR_CASES) {
			expectPgParity([cond(c.columnId, c.operator, c.value)]);
		}
	});

	it("covers every canonical operator in the matrix", () => {
		const covered = new Set(OPERATOR_CASES.map((c) => c.operator));
		for (const operator of FILTER_OPERATORS) {
			expect(covered.has(operator), `missing operator: ${operator}`).toBe(true);
		}
	});

	it("matches for the legacy include/exclude aliases", () => {
		expectPgParity([cond("tags", "include" as FilterOperator, ["a"])]);
		expectPgParity([cond("tags", "exclude" as FilterOperator, ["a"])]);
	});

	it("matches for mixed and/or condition lists", () => {
		expectPgParity([
			cond("title", "eq", "a"),
			cond("status", "eq", "b"),
			cond("estimate", "gt", 1, "or"),
			cond("tags", "includeAny", ["x"], "or"),
		]);
		expectPgParity([
			cond("title", "contains", "a"),
			cond("estimate", "lt", 5),
			cond("status", "in", ["todo"]),
		]);
	});
});

describe("buildFilterWherePg semantics snapshots", () => {
	it("returns empty sql for empty input", () => {
		expect(buildFilterWherePg([], COLUMNS, MAPPING)).toEqual({
			params: [],
			sql: "",
		});
	});

	it("comparison: eq/gt with $n placeholders", () => {
		expect(expectPgParity([cond("estimate", "gt", 3)]).sql).toBe(
			'"estimate" > $1',
		);
		expect(expectPgParity([cond("title", "eq", "x")]).sql).toBe('"title" = $1');
	});

	it("like: ILIKE with escaped wildcards by default", () => {
		expect(expectPgParity([cond("title", "contains", "a%b_c\\d")])).toEqual({
			params: ["%a\\%b\\_c\\\\d%"],
			sql: "\"title\" ILIKE $1 ESCAPE '\\'",
		});
	});

	it("like: caseSensitive opts into binary LIKE", () => {
		expect(
			expectPgParity([cond("title", "startsWith", "Pol")], undefined, {
				caseSensitive: true,
			}).sql,
		).toBe("\"title\" LIKE $1 ESCAPE '\\'");
	});

	it("nullary: isEmpty/isNotEmpty on text matches NULL or ''", () => {
		expect(expectPgParity([cond("title", "isEmpty", null)]).sql).toBe(
			'("title" IS NULL OR "title" = \'\')',
		);
		expect(expectPgParity([cond("title", "isNotEmpty", null)]).sql).toBe(
			'("title" IS NOT NULL AND "title" != \'\')',
		);
	});

	it("nullary: isEmpty/isNotEmpty on non-text matches NULL only", () => {
		expect(expectPgParity([cond("estimate", "isEmpty", null)]).sql).toBe(
			'"estimate" IS NULL',
		);
		expect(expectPgParity([cond("estimate", "isNotEmpty", null)]).sql).toBe(
			'"estimate" IS NOT NULL',
		);
	});

	it("set: in/notIn with empty-array sentinels", () => {
		expect(expectPgParity([cond("status", "in", ["todo", "done"])]).sql).toBe(
			'"status" IN ($1, $2)',
		);
		expect(expectPgParity([cond("status", "in", [])]).sql).toBe("(1=0)");
		expect(expectPgParity([cond("status", "notIn", [])]).sql).toBe("(1=1)");
	});

	it("array: text[] @> / && with NOT wrapper for excludes", () => {
		expect(expectPgParity([cond("tags", "includeAll", ["a", "b"])]).sql).toBe(
			'"tags" @> ARRAY[$1, $2]::text[]',
		);
		expect(expectPgParity([cond("tags", "includeAny", ["a"])]).sql).toBe(
			'"tags" && ARRAY[$1]::text[]',
		);
		expect(expectPgParity([cond("tags", "excludeAll", ["a"])]).sql).toBe(
			'NOT ("tags" @> ARRAY[$1]::text[])',
		);
		expect(expectPgParity([cond("tags", "excludeAny", ["a"])]).sql).toBe(
			'NOT ("tags" && ARRAY[$1]::text[])',
		);
	});

	it("range: BETWEEN with two params", () => {
		expect(expectPgParity([cond("estimate", "between", [1, 10])]).sql).toBe(
			'"estimate" BETWEEN $1 AND $2',
		);
	});

	it("qualifies columns with the table alias", () => {
		expect(
			expectPgParity([cond("title", "eq", "x")], undefined, {
				tableAlias: "tasks",
			}).sql,
		).toBe('"tasks"."title" = $1');
	});

	it("fans _search across searchable columns with OR", () => {
		expect(expectPgParity([createSearchFilter("pol")]).sql).toBe(
			"(\"title\" ILIKE $1 ESCAPE '\\' OR \"status\" ILIKE $2 ESCAPE '\\')",
		);
	});

	it("fans _search to a single predicate with one searchable column", () => {
		const single: ColumnConfig[] = [
			{ displayName: "Title", id: "title", searchable: true, type: "string" },
		];
		expect(expectPgParity([createSearchFilter("x")], single).sql).toBe(
			"\"title\" ILIKE $1 ESCAPE '\\'",
		);
	});

	it("numbers placeholders sequentially across conditions", () => {
		const pg = expectPgParity([
			cond("title", "contains", "a"),
			cond("estimate", "between", [1, 2], "or"),
			cond("tags", "includeAny", ["x", "y"]),
		]);
		expect(pg.sql.match(/\$\d+/g)).toEqual(["$1", "$2", "$3", "$4", "$5"]);
		expect(pg.params).toHaveLength(5);
	});
});

describe("buildFilterWherePg typed errors", () => {
	const codeOf = (run: () => unknown): string => {
		try {
			run();
			expect.unreachable();
		} catch (error) {
			expect(error).toBeInstanceOf(DataExplorerError);
			return (error as DataExplorerError).code;
		}
	};

	it("throws NO_SEARCHABLE_COLUMN with zero searchable columns", () => {
		const nonSearchable: ColumnConfig[] = [
			{ displayName: "N", id: "estimate", type: "number" },
		];
		expect(() =>
			buildFilterWherePg([createSearchFilter("x")], nonSearchable, {
				estimate: "estimate",
			}),
		).toThrowError(DataExplorerError);
		expect(
			codeOf(() =>
				buildFilterWherePg([createSearchFilter("x")], nonSearchable, {
					estimate: "estimate",
				}),
			),
		).toBe("NO_SEARCHABLE_COLUMN");
	});

	it("requires a string value for _search", () => {
		expect(
			codeOf(() =>
				buildFilterWherePg(
					[cond(SEARCH_COLUMN_ID, "contains", 42)],
					COLUMNS,
					MAPPING,
				),
			),
		).toBe("INVALID_FILTER_VALUE");
	});

	it("throws UNKNOWN_COLUMN for unknown ids (validation precedes codegen)", () => {
		expect(codeOf(() => expectPgParity([cond("nope", "eq", "x")]))).toBe(
			"UNKNOWN_COLUMN",
		);
	});

	it("throws MISSING_MAPPING for known-but-unmapped columns", () => {
		expect(codeOf(() => expectPgParity([cond("notes", "eq", "x")]))).toBe(
			"MISSING_MAPPING",
		);
	});
});

describe("buildFilterWherePg type surface", () => {
	it("rejects dialect/placeholderStyle at compile time (runtime ignores extras)", () => {
		expect(
			buildFilterWherePg([], COLUMNS, MAPPING, {
				// @ts-expect-error `dialect` is not part of the pg-only surface.
				dialect: "sqlite",
			}),
		).toEqual({ params: [], sql: "" });
	});
});
