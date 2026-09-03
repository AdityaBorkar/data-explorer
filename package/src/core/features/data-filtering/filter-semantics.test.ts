import { describe, expect, it } from "vitest";

import {
	coerceFilterValue,
	isNullaryOperator,
	isRangeOperator,
	isValidOperatorValue,
	requiresArrayValue,
	requiresValue,
	validateFilterValue,
	validateOperatorValue,
} from "./filter-semantics.ts";

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

	it("requires a non-blank value for single operators", () => {
		expect(validateFilterValue("eq", "x")).toBeUndefined();
		expect(validateFilterValue("eq", "")).toMatch(/non-null/);
		expect(validateFilterValue("eq", null)).toMatch(/non-null/);
		expect(validateFilterValue("eq", undefined)).toMatch(/non-null/);
	});
});

describe("predicates", () => {
	it("classifies arity", () => {
		expect(isNullaryOperator("isEmpty")).toBe(true);
		expect(isNullaryOperator("eq")).toBe(false);
		expect(isRangeOperator("between")).toBe(true);
		expect(isRangeOperator("eq")).toBe(false);
		expect(requiresArrayValue("in")).toBe(true);
		expect(requiresArrayValue("includeAll")).toBe(true);
		expect(requiresArrayValue("eq")).toBe(false);
		expect(requiresValue("isEmpty")).toBe(false);
		expect(requiresValue("eq")).toBe(true);
	});

	it("validates boolean-style checks", () => {
		expect(isValidOperatorValue("eq", "x")).toBe(true);
		expect(isValidOperatorValue("eq", "")).toBe(false);
		expect(() => validateOperatorValue("eq", "")).toThrow();
		expect(() => validateOperatorValue("eq", "x")).not.toThrow();
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
