import { describe, expect, it } from "vitest";

import type { ColumnConfig } from "../columns.ts";
import { DataExplorerError } from "../errors.ts";
import { deserializeFilters } from "../features/data-filtering/filter-utils.ts";
import type { FilterCondition } from "../filters.ts";
import { buildFilterWhere } from "./filter-sql.ts";

const COLUMNS: ColumnConfig[] = [
	{ displayName: "Title", id: "title", searchable: true, type: "string" },
	{ displayName: "Status", id: "status", searchable: true, type: "enum" },
	{ displayName: "Estimate", id: "estimate", type: "number" },
	{ displayName: "Tags", id: "tags", type: "multiEnum" },
];

const MAPPING = {
	estimate: "estimate",
	status: "status",
	tags: "tags",
	title: "title",
};

function cond(
	columnId: string,
	operator: FilterCondition["operator"],
	value: unknown,
): FilterCondition {
	return {
		columnId,
		combinator: "and",
		id: `${columnId}-${operator}`,
		operator,
		value,
	};
}

describe("buildFilterWhere empty contract", () => {
	it("returns empty sql instead of undefined", () => {
		expect(buildFilterWhere([], COLUMNS, MAPPING)).toEqual({
			params: [],
			sql: "",
		});
	});
});

describe("buildFilterWhere isEmpty semantics", () => {
	it("matches NULL or empty string for text columns", () => {
		const result = buildFilterWhere(
			[cond("title", "isEmpty", null)],
			COLUMNS,
			MAPPING,
		);
		expect(result.sql).toBe('("title" IS NULL OR "title" = \'\')');
		expect(result.params).toEqual([]);
	});

	it("matches NULL only for non-text columns", () => {
		const result = buildFilterWhere(
			[cond("estimate", "isEmpty", null)],
			COLUMNS,
			MAPPING,
		);
		expect(result.sql).toBe('"estimate" IS NULL');
	});

	it("negates empty strings for text isNotEmpty", () => {
		const result = buildFilterWhere(
			[cond("title", "isNotEmpty", null)],
			COLUMNS,
			MAPPING,
		);
		expect(result.sql).toBe('("title" IS NOT NULL AND "title" != \'\')');
	});
});

describe("buildFilterWhere empty IN", () => {
	it("emits (1=0) for empty IN", () => {
		const result = buildFilterWhere(
			[cond("status", "in", [])],
			COLUMNS,
			MAPPING,
		);
		expect(result.sql).toBe("(1=0)");
	});

	it("emits (1=1) for empty NOT IN", () => {
		const result = buildFilterWhere(
			[cond("status", "notIn", [])],
			COLUMNS,
			MAPPING,
		);
		expect(result.sql).toBe("(1=1)");
	});
});

describe("buildFilterWhere dialects", () => {
	it("keeps postgres ILIKE output by default", () => {
		const result = buildFilterWhere(
			[cond("title", "contains", "a%b_c\\d")],
			COLUMNS,
			MAPPING,
		);
		expect(result.sql).toContain("ILIKE");
		expect(result.params).toEqual(["%a\\%b\\_c\\\\d%"]);
	});

	it("uses LOWER(col) LIKE for sqlite", () => {
		const result = buildFilterWhere(
			[cond("title", "contains", "x")],
			COLUMNS,
			MAPPING,
			{
				dialect: "sqlite",
			},
		);
		expect(result.sql).toBe("LOWER(\"title\") LIKE LOWER(?) ESCAPE '\\'");
		expect(result.params).toEqual(["%x%"]);
	});

	it("uses binary LIKE for caseSensitive sqlite", () => {
		const result = buildFilterWhere(
			[cond("title", "eq", "x")],
			COLUMNS,
			MAPPING,
			{
				caseSensitive: true,
				dialect: "sqlite",
			},
		);
		expect(result.sql).toBe('"title" = ?');
	});

	it("rejects array containment outside postgres", () => {
		const run = () =>
			buildFilterWhere([cond("tags", "includeAll", ["a"])], COLUMNS, MAPPING, {
				dialect: "sqlite",
			});
		expect(run).toThrowError(DataExplorerError);
		try {
			run();
		} catch (error) {
			expect((error as DataExplorerError).code).toBe("UNSUPPORTED_DIALECT");
		}
	});

	it("quotes identifiers with backticks for mysql", () => {
		const result = buildFilterWhere(
			[cond("title", "eq", "x")],
			COLUMNS,
			MAPPING,
			{
				dialect: "mysql",
				tableAlias: "tasks",
			},
		);
		expect(result.sql).toBe("`tasks`.`title` = ?");
	});
});

describe("buildFilterWhere typed errors", () => {
	it("carries columnId for unknown columns", () => {
		try {
			buildFilterWhere([cond("nope", "eq", "x")], COLUMNS, MAPPING);
			expect.unreachable();
		} catch (error) {
			expect(error).toBeInstanceOf(DataExplorerError);
			expect((error as DataExplorerError).code).toBe("UNKNOWN_COLUMN");
			expect((error as DataExplorerError).details?.columnId).toBe("nope");
		}
	});

	it("normalizes legacy include/exclude aliases from stored JSON", () => {
		const legacy = JSON.stringify([
			{ b: "and", c: "tags", i: "legacy-1", o: "include", v: ["a"] },
		]);
		const withAlias = buildFilterWhere(
			deserializeFilters(legacy),
			COLUMNS,
			MAPPING,
		);
		const canonical = buildFilterWhere(
			[cond("tags", "includeAll", ["a"])],
			COLUMNS,
			MAPPING,
		);
		expect(withAlias.sql).toBe(canonical.sql);
		expect(withAlias.params).toEqual(canonical.params);
	});

	it("requires searchable columns for _search", () => {
		const nonSearchable: ColumnConfig[] = [
			{ displayName: "N", id: "estimate", type: "number" },
		];
		try {
			buildFilterWhere([cond("_search", "contains", "x")], nonSearchable, {
				estimate: "estimate",
			});
			expect.unreachable();
		} catch (error) {
			expect((error as DataExplorerError).code).toBe("NO_SEARCHABLE_COLUMN");
		}
	});
});
