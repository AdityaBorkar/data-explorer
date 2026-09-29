import { describe, expect, it } from "vitest";

import { coerceFilterValue, validateFilterValue } from "./filter-semantics.ts";
import { getOperatorArity } from "./operators.ts";

describe("validateFilterValue", () => {
	it("requires null for nullary operators", () => {
		expect(validateFilterValue("isEmpty", null)).toBeUndefined();
		expect(validateFilterValue("isEmpty", "x")).toMatch(/requires null/);
		expect(validateFilterValue("isNotEmpty", null)).toBeUndefined();
	});

	it("requires [min, max] tuples for range operators", () => {
		expect(validateFilterValue("between", [1, 2], "number")).toBeUndefined();
		expect(validateFilterValue("between", [1], "number")).toMatch(/tuple/);
		expect(validateFilterValue("between", "x", "number")).toMatch(/tuple/);
		expect(validateFilterValue("between", ["a", "b"], "date")).toBeUndefined();
	});

	it("enforces number tuples on number columns", () => {
		expect(validateFilterValue("between", ["a", "b"], "number")).toMatch(
			/number, number/,
		);
		expect(validateFilterValue("notBetween", [1, 2], "number")).toBeUndefined();
	});

	it("requires arrays for set/array operators", () => {
		expect(validateFilterValue("in", ["a"])).toBeUndefined();
		expect(validateFilterValue("in", "a")).toMatch(/string\[\]/);
		expect(validateFilterValue("includeAny", ["a"])).toBeUndefined();
		expect(validateFilterValue("excludeAll", "a")).toMatch(/string\[\]/);
	});

	it("rejects non-scalar elements in set/array operators", () => {
		expect(validateFilterValue("in", [["a"]])).toMatch(/string\[\]/);
		expect(validateFilterValue("in", [null])).toMatch(/string\[\]/);
		expect(validateFilterValue("includeAny", [{ v: "a" }])).toMatch(
			/string\[\]/,
		);
	});

	it("validates date range contents", () => {
		expect(
			validateFilterValue("between", ["2024-01-01", "2024-12-31"], "date"),
		).toBeUndefined();
		expect(
			validateFilterValue(
				"between",
				[
					new Date("2024-01-01T00:00:00.000Z"),
					new Date("2024-12-31T00:00:00.000Z"),
				],
				"date",
			),
		).toBeUndefined();
		expect(validateFilterValue("between", ["", "2024-12-31"], "date")).toMatch(
			/date/,
		);
		expect(validateFilterValue("between", ["a", "b"], "date")).toBeUndefined();
	});

	it("requires a non-blank value for single operators", () => {
		expect(validateFilterValue("eq", "x")).toBeUndefined();
		expect(validateFilterValue("eq", "")).toMatch(/non-null/);
		expect(validateFilterValue("eq", null)).toMatch(/non-null/);
		expect(validateFilterValue("eq", undefined)).toMatch(/non-null/);
	});
});

describe("getOperatorArity", () => {
	it("classifies nullary, range, set/array, and single operators", () => {
		expect(getOperatorArity("isEmpty")).toBe("nullary");
		expect(getOperatorArity("eq")).toBe("single");
		expect(getOperatorArity("between")).toBe("range");
		expect(getOperatorArity("in")).toBe("set");
		expect(getOperatorArity("includeAll")).toBe("array");
	});

	it("answers the former predicate questions through one seam", () => {
		expect(getOperatorArity("eq") !== "nullary").toBe(true);
		expect(getOperatorArity("isEmpty") !== "nullary").toBe(false);
		expect(validateFilterValue("eq", "x") === undefined).toBe(true);
		expect(validateFilterValue("eq", "") === undefined).toBe(false);
	});
});

describe("coerceFilterValue", () => {
	it("commits null for nullary operators", () => {
		expect(coerceFilterValue("isEmpty", undefined)).toEqual({
			hasValue: true,
			value: null,
		});
	});

	it("rejects blank pending values", () => {
		expect(coerceFilterValue("eq", undefined).hasValue).toBe(false);
		expect(coerceFilterValue("eq", null).hasValue).toBe(false);
		expect(coerceFilterValue("eq", "").hasValue).toBe(false);
		expect(coerceFilterValue("eq", "   ").hasValue).toBe(false);
		expect(coerceFilterValue("in", []).hasValue).toBe(false);
	});

	it("accepts real values untouched", () => {
		expect(coerceFilterValue("eq", "x")).toEqual({
			hasValue: true,
			value: "x",
		});
		expect(coerceFilterValue("in", ["a"])).toEqual({
			hasValue: true,
			value: ["a"],
		});
	});
});
