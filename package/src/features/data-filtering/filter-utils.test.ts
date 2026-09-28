import { describe, expect, it } from "vitest";

import type { FilterCondition } from "../../filters.ts";
import { deserializeFilters, serializeFilters } from "./filter-utils.ts";

function cond(
	columnId: string,
	operator: "eq" | "contains" | "between" | "in" | "isEmpty",
	value: unknown,
	combinator: "and" | "or",
): FilterCondition {
	return { columnId, combinator, id: "test-id", operator, value };
}

describe("serializeFilters / deserializeFilters", () => {
	it("round-trips basic conditions", () => {
		const conditions: FilterCondition[] = [
			cond("name", "eq", "foo", "and"),
			cond("archived", "eq", "true", "or"),
		];
		const json = serializeFilters(conditions);
		const result = deserializeFilters(json);

		expect(result).toHaveLength(2);
		expect(result[0]?.columnId).toBe("name");
		expect(result[0]?.operator).toBe("eq");
		expect(result[0]?.value).toBe("foo");
		expect(result[0]?.combinator).toBe("and");
		expect(result[1]?.columnId).toBe("archived");
		expect(result[1]?.combinator).toBe("or");
	});

	it("regenerates nanoid IDs on deserialize", () => {
		const conditions = [cond("name", "eq", "foo", "and")];
		const json = serializeFilters(conditions);
		const result = deserializeFilters(json);

		// ids are preserved when serialized
		expect(result[0]?.id).toBe("test-id");

		const withoutId = JSON.stringify([
			{ b: "and", c: "name", o: "eq", v: "foo" },
		]);
		const fallback = deserializeFilters(withoutId);
		expect(fallback[0]?.id).toBeTruthy();
		expect(fallback[0]?.id).not.toBe("test-id");
	});

	it("handles null values (isEmpty)", () => {
		const conditions: FilterCondition[] = [
			{
				columnId: "name",
				combinator: "and",
				id: "x",
				operator: "isEmpty",
				value: null,
			},
		];
		const json = serializeFilters(conditions);
		const result = deserializeFilters(json);

		expect(result[0]?.value).toBeNull();
	});

	it("handles between tuples", () => {
		const conditions: FilterCondition[] = [
			{
				columnId: "createdAt",
				combinator: "and",
				id: "x",
				operator: "between",
				value: ["2024-01-01", "2024-12-31"],
			},
		];
		const json = serializeFilters(conditions);
		const result = deserializeFilters(json);

		expect(result[0]?.value).toEqual(["2024-01-01", "2024-12-31"]);
	});

	it("handles string arrays for in/notIn", () => {
		const conditions: FilterCondition[] = [
			{
				columnId: "assigneeId",
				combinator: "and",
				id: "x",
				operator: "in",
				value: ["user-1", "user-2"],
			},
		];
		const json = serializeFilters(conditions);
		const result = deserializeFilters(json);

		expect(result[0]?.value).toEqual(["user-1", "user-2"]);
	});

	it("handles empty array", () => {
		const json = serializeFilters([]);
		const result = deserializeFilters(json);
		expect(result).toHaveLength(0);
	});

	it("serializes Date values as ISO strings", () => {
		const date = new Date("2024-06-15T12:00:00.000Z");
		const conditions: FilterCondition[] = [
			{
				columnId: "createdAt",
				combinator: "and",
				id: "x",
				operator: "eq",
				value: date,
			},
		];
		const json = serializeFilters(conditions);
		const parsed = JSON.parse(json) as {
			filters: { v: string }[];
			v: number;
		};
		expect(parsed.v).toBe(1);
		expect(parsed.filters[0]?.v).toBe("2024-06-15T12:00:00.000Z");
	});

	it("revives Date values on deserialize", () => {
		const date = new Date("2024-06-15T12:00:00.000Z");
		const conditions: FilterCondition[] = [
			{
				columnId: "createdAt",
				combinator: "and",
				id: "x",
				operator: "eq",
				value: date,
			},
		];
		const result = deserializeFilters(serializeFilters(conditions));
		expect(result).toHaveLength(1);
		const value = result[0]?.value;
		expect(value).toBeInstanceOf(Date);
		if (!(value instanceof Date)) throw new Error("expected Date revival");
		expect(value.toISOString()).toBe("2024-06-15T12:00:00.000Z");
	});

	it("reads legacy bare-array payloads", () => {
		const legacy = JSON.stringify([
			{ b: "and", c: "name", i: "legacy-1", o: "eq", v: "foo" },
		]);
		const result = deserializeFilters(legacy);
		expect(result).toHaveLength(1);
		expect(result[0]?.id).toBe("legacy-1");
		expect(result[0]?.value).toBe("foo");
	});

	it("rejects unknown payload versions", () => {
		expect(() =>
			deserializeFilters(JSON.stringify({ filters: [], v: 999 })),
		).toThrow(/version/i);
	});

	it("rejects invalid combinators instead of coercing to and", () => {
		const bad = JSON.stringify([
			{ b: "xor", c: "name", i: "x", o: "eq", v: "foo" },
		]);
		expect(() => deserializeFilters(bad)).toThrow(/combinator/i);
	});

	it("round-trips Date tuples for range operators", () => {
		const range: FilterCondition[] = [
			{
				columnId: "createdAt",
				combinator: "and",
				id: "x",
				operator: "between",
				value: [
					new Date("2024-01-01T00:00:00.000Z"),
					new Date("2024-12-31T00:00:00.000Z"),
				],
			},
		];
		const result = deserializeFilters(serializeFilters(range));
		expect(result).toHaveLength(1);
		const value = result[0]?.value;
		expect(value).toEqual([
			new Date("2024-01-01T00:00:00.000Z"),
			new Date("2024-12-31T00:00:00.000Z"),
		]);
	});
	it("round-trips Dates nested in objects", () => {
		const conditions: FilterCondition[] = [
			{
				columnId: "meta",
				combinator: "and",
				id: "x",
				operator: "eq",
				value: { at: new Date("2024-06-15T12:00:00.000Z"), label: "x" },
			},
		];
		const result = deserializeFilters(serializeFilters(conditions));
		expect(result).toHaveLength(1);
		const value = result[0]?.value as { at: unknown; label: unknown };
		expect(value.at).toBeInstanceOf(Date);
		expect(value.label).toBe("x");
	});
});
