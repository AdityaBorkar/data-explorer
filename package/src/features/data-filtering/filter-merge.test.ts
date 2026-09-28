import { describe, expect, it } from "vitest";

import type { FilterCondition, FilterViewDisplay } from "../../types.ts";
import { mergeDisplay } from "../display-snapshot.ts";
import {
	computeOverrides,
	conditionsEqual,
	filterKey,
	mergeFilters,
} from "./filter-merge.ts";

function cond(
	columnId: string,
	operator: "eq" | "contains",
	value: unknown,
	combinator: "and" | "or",
	id?: string,
): FilterCondition {
	return {
		columnId,
		combinator,
		id: id ?? `${columnId}-${operator}-${String(value)}`,
		operator,
		value,
	};
}

describe("filterKey", () => {
	it("includes column, operator, combinator, and stable value hash", () => {
		expect(filterKey(cond("name", "eq", "foo", "and"))).toBe(
			'name::eq::and::"foo"',
		);
	});

	it("distinguishes different values", () => {
		expect(filterKey(cond("name", "eq", "foo", "and"))).not.toBe(
			filterKey(cond("name", "eq", "bar", "and")),
		);
	});

	it("is key-order stable for object values", () => {
		const a: FilterCondition = {
			columnId: "meta",
			combinator: "and",
			id: "a",
			operator: "eq",
			value: { x: 1, y: 2 },
		};
		const b: FilterCondition = {
			columnId: "meta",
			combinator: "and",
			id: "b",
			operator: "eq",
			value: { x: 1, y: 2 },
		};
		expect(filterKey(a)).toBe(filterKey(b));
	});
});

describe("conditionsEqual", () => {
	it("returns true for identical conditions", () => {
		const a = cond("name", "eq", "foo", "and");
		const b = cond("name", "eq", "foo", "and");
		expect(conditionsEqual(a, b)).toBe(true);
	});

	it("returns false for different values", () => {
		const a = cond("name", "eq", "foo", "and");
		const b = cond("name", "eq", "bar", "and");
		expect(conditionsEqual(a, b)).toBe(false);
	});

	it("returns false for different operators", () => {
		const a = cond("name", "eq", "foo", "and");
		const b = cond("name", "contains", "foo", "and");
		expect(conditionsEqual(a, b)).toBe(false);
	});

	it("ignores id field", () => {
		const a: FilterCondition = {
			columnId: "name",
			combinator: "and",
			id: "id-1",
			operator: "eq",
			value: "foo",
		};
		const b: FilterCondition = {
			columnId: "name",
			combinator: "and",
			id: "id-2",
			operator: "eq",
			value: "foo",
		};
		expect(conditionsEqual(a, b)).toBe(true);
	});
});

describe("mergeFilters", () => {
	it("returns base when no overrides", () => {
		const base = [cond("name", "eq", "foo", "and")];
		const result = mergeFilters(base, []);
		expect(result).toHaveLength(1);
		expect(result[0]?.columnId).toBe("name");
	});

	it("overrides by id", () => {
		const base = [cond("name", "eq", "foo", "and", "same-id")];
		const overrides = [cond("name", "eq", "bar", "and", "same-id")];
		const result = mergeFilters(base, overrides);
		expect(result).toHaveLength(1);
		expect(result[0]?.value).toBe("bar");
	});

	it("appends new conditions from overrides", () => {
		const base = [cond("name", "eq", "foo", "and")];
		const overrides = [cond("slug", "contains", "test", "and")];
		const result = mergeFilters(base, overrides);
		expect(result).toHaveLength(2);
	});

	it("keeps base when override matches exactly", () => {
		const base = [cond("name", "eq", "foo", "and")];
		const overrides = [cond("name", "eq", "foo", "and")];
		const result = mergeFilters(base, overrides);
		expect(result).toHaveLength(1);
		expect(result[0]?.value).toBe("foo");
	});

	it("preserves duplicate column+operator conditions", () => {
		const base = [
			cond("name", "eq", "foo", "and", "id-1"),
			cond("name", "eq", "bar", "and", "id-2"),
		];
		const result = mergeFilters(base, []);
		expect(result).toHaveLength(2);
		expect(result.map((c) => c.value)).toEqual(["foo", "bar"]);
	});
});

describe("computeOverrides", () => {
	it("returns empty when effective matches base", () => {
		const base = [cond("name", "eq", "foo", "and")];
		const effective = [cond("name", "eq", "foo", "and")];
		const result = computeOverrides(base, effective);
		expect(result).toHaveLength(0);
	});

	it("returns changed conditions", () => {
		const base = [cond("name", "eq", "foo", "and", "same-id")];
		const effective = [cond("name", "eq", "bar", "and", "same-id")];
		const result = computeOverrides(base, effective);
		expect(result).toHaveLength(1);
		expect(result[0]?.value).toBe("bar");
	});

	it("returns new conditions not in base", () => {
		const base = [cond("name", "eq", "foo", "and")];
		const effective = [
			cond("name", "eq", "foo", "and"),
			cond("slug", "contains", "test", "and"),
		];
		const result = computeOverrides(base, effective);
		expect(result).toHaveLength(1);
		expect(result[0]?.columnId).toBe("slug");
	});
});

describe("mergeDisplay", () => {
	const base: FilterViewDisplay = {
		columnWidths: {},
		density: "comfortable",
		fields: ["name", "slug"],
		groupBy: null,
		orderBy: "createdAt",
		orderType: "desc",
		type: "table",
	};

	it("returns base when no overrides", () => {
		const result = mergeDisplay(base, {});
		expect(result).toEqual(base);
	});

	it("overrides individual fields", () => {
		const result = mergeDisplay(base, { density: "compact", orderBy: "name" });
		expect(result.density).toBe("compact");
		expect(result.orderBy).toBe("name");
		expect(result.orderType).toBe("desc");
		expect(result.type).toBe("table");
	});

	it("respects type and groupBy overrides", () => {
		const result = mergeDisplay(base, { groupBy: "status", type: "board" });
		expect(result.type).toBe("board");
		expect(result.groupBy).toBe("status");
	});
});
