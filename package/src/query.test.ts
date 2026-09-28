import { describe, expect, it } from "vitest";

import { dataQueryKey, hashRefine, stableStringify } from "./query.ts";

describe("stableStringify", () => {
	it("is key-order stable for objects", () => {
		expect(stableStringify({ x: 1, y: 2 })).toBe(
			stableStringify({ x: 1, y: 2 }),
		);
	});

	it("distinguishes null, undefined, and Dates", () => {
		expect(stableStringify(null)).toBe("null");
		expect(stableStringify(undefined)).toBe("undefined");
		expect(stableStringify(new Date("2024-06-15T12:00:00.000Z"))).toBe(
			"Date:2024-06-15T12:00:00.000Z",
		);
	});

	it("nests arrays and objects deterministically", () => {
		expect(stableStringify([{ a: 2, b: 1 }])).toBe('[{"a":2,"b":1}]');
	});
});

describe("dataQueryKey", () => {
	it("returns the domain key without refine", () => {
		expect(dataQueryKey("tasks")).toEqual(["data-explorer", "tasks"]);
	});

	it("hashes the data-affecting refine slices", () => {
		const refine = { dataFilters: [], grouping: [], sorting: [] };
		expect(dataQueryKey("tasks", refine)).toEqual([
			"data-explorer",
			"tasks",
			hashRefine(refine),
		]);
	});

	it("is stable for structurally identical refines", () => {
		const a = { dataFilters: [], grouping: [], sorting: [] };
		const b = { dataFilters: [], grouping: [], sorting: [] };
		expect(dataQueryKey("tasks", a)).toEqual(dataQueryKey("tasks", b));
	});
});
