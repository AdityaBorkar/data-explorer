import { describe, expect, it } from "vitest";

import type { ColumnConfig } from "../../columns.ts";
import {
	buildDraftCondition,
	commitDraft,
	editorKind,
	formatFilterValue,
	quickAddCondition,
} from "./filter-draft.ts";

function column(overrides: Partial<ColumnConfig> = {}): ColumnConfig {
	return { displayName: "Name", id: "name", type: "string", ...overrides };
}

describe("commitDraft", () => {
	it("commits valued operators with column type validation", () => {
		const result = commitDraft("age", "between", [1, 2], "number");
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.condition.columnId).toBe("age");
			expect(result.condition.operator).toBe("between");
			expect(result.condition.value).toEqual([1, 2]);
			expect(result.condition.combinator).toBe("and");
			expect(result.condition.id).toBeTruthy();
		}
	});

	it("blocks blank values", () => {
		expect(commitDraft("name", "eq", "").ok).toBe(false);
		expect(commitDraft("name", "eq", undefined).ok).toBe(false);
		expect(commitDraft("tags", "in", []).ok).toBe(false);
	});

	it("blocks values that fail type validation", () => {
		const result = commitDraft("age", "between", ["a", "b"], "number");
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toMatch(/number, number/);
	});

	it("commits nullary operators to null", () => {
		const result = commitDraft("name", "isEmpty", undefined, "string");
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.condition.value).toBeNull();
	});
});

describe("buildDraftCondition", () => {
	it("builds an and-combined condition with an id", () => {
		const cond = buildDraftCondition("name", "eq", "x");
		expect(cond).toMatchObject({
			columnId: "name",
			combinator: "and",
			operator: "eq",
			value: "x",
		});
		expect(cond.id).toBeTruthy();
	});
});

describe("quickAddCondition", () => {
	it("commits scalar eq for plain columns", () => {
		const cond = quickAddCondition(column(), "x");
		expect(cond).toMatchObject({
			columnId: "name",
			combinator: "and",
			operator: "eq",
			value: "x",
		});
		expect(cond.id).toBeTruthy();
	});

	it("commits includeAny arrays for multiEnum columns", () => {
		const cond = quickAddCondition(
			column({ id: "tags", type: "multiEnum" }),
			"a",
		);
		expect(cond).toMatchObject({
			columnId: "tags",
			operator: "includeAny",
			value: ["a"],
		});
	});

	it("honors per-column quickOperator overrides", () => {
		const cond = quickAddCondition(
			column({ id: "tags", quickOperator: "includeAll", type: "multiEnum" }),
			"a",
		);
		expect(cond).toMatchObject({ operator: "includeAll", value: ["a"] });

		const scalar = quickAddCondition(
			column({ quickOperator: "neq", type: "string" }),
			"x",
		);
		expect(scalar).toMatchObject({ operator: "neq", value: "x" });
	});
});

describe("editorKind", () => {
	it("routes nullary, search, range, multi, single", () => {
		expect(editorKind("isEmpty", column())).toBe("nullary");
		expect(
			editorKind("contains", column({ id: "_search", type: "string" })),
		).toBe("search");
		expect(editorKind("between", column({ type: "number" }))).toBe("range");
		expect(editorKind("in", column({ type: "enum" }))).toBe("multi");
		expect(editorKind("includeAny", column({ type: "multiEnum" }))).toBe(
			"multi",
		);
		expect(editorKind("eq", column())).toBe("single");
		expect(editorKind("eq", column({ type: "boolean" }))).toBe("single");
	});
});

describe("formatFilterValue", () => {
	it("returns null for nullary and empty values", () => {
		expect(formatFilterValue("x", "isEmpty", column())).toBeNull();
		expect(formatFilterValue(null, "eq", column())).toBeNull();
		expect(formatFilterValue(undefined, "eq", column())).toBeNull();
		expect(formatFilterValue([], "in", column())).toBeNull();
	});

	it("formats ranges", () => {
		expect(formatFilterValue([1, 2], "between", column())).toBe("1 – 2");
		expect(formatFilterValue("x", "between", column())).toBeNull();
	});

	it("formats option sets with labels and truncation", () => {
		const col = column({
			options: [
				{ label: "One", value: "1" },
				{ label: "Two", value: "2" },
				{ label: "Three", value: "3" },
			],
			type: "enum",
		});
		expect(formatFilterValue(["1", "2"], "in", col)).toBe("One, Two");
		expect(formatFilterValue(["1", "2", "3"], "in", col)).toBe("One, Two...");
		expect(formatFilterValue(["9"], "in", col)).toBe("9");
	});

	it("formats booleans and truncates long strings", () => {
		expect(formatFilterValue(true, "eq", column({ type: "boolean" }))).toBe(
			"Yes",
		);
		expect(formatFilterValue(false, "eq", column({ type: "boolean" }))).toBe(
			"No",
		);
		expect(formatFilterValue("x".repeat(30), "eq", column())).toBe(
			`${"x".repeat(20)}...`,
		);
	});

	it("honors truncation budgets", () => {
		expect(
			formatFilterValue("x".repeat(30), "eq", column(), { maxInlineChars: 5 }),
		).toBe("xxxxx...");
		expect(
			formatFilterValue(["1", "2", "3"], "in", column({ type: "enum" }), {
				maxInlineLabels: 5,
			}),
		).toBe("1, 2, 3");
	});
});
