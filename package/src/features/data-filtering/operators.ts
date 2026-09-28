import type { ColumnDataType } from "../../columns.ts";
import type { FilterOperator } from "../../filters.ts";

/**
 * Which predicate to use: arity questions ("is this nullary?", "should I
 * render a value input?") go to {@link getOperatorArity} directly.
 */
export type OperatorArity = "nullary" | "single" | "range" | "set" | "array";

interface OperatorDef {
	arity: OperatorArity;
	key: FilterOperator;
	label: string;
}

/**
 * Canonical operator definitions: arity + label live here exactly once.
 * Per-type lists below reference these keys, so shared operators (`eq`,
 * `neq`) can't silently change meaning when a per-type list is reordered.
 */
const OPERATOR_DEFS: Record<FilterOperator, OperatorDef> = {
	between: { arity: "range", key: "between", label: "is between" },
	contains: { arity: "single", key: "contains", label: "contains" },
	endsWith: { arity: "single", key: "endsWith", label: "ends with" },
	eq: { arity: "single", key: "eq", label: "is" },
	excludeAll: { arity: "array", key: "excludeAll", label: "excludes if all" },
	excludeAny: {
		arity: "array",
		key: "excludeAny",
		label: "excludes if any of",
	},
	gt: { arity: "single", key: "gt", label: "is after" },
	gte: {
		arity: "single",
		key: "gte",
		label: "is on or after",
	},
	in: { arity: "set", key: "in", label: "is any of" },
	includeAll: { arity: "array", key: "includeAll", label: "includes all of" },
	includeAny: { arity: "array", key: "includeAny", label: "includes any of" },
	isEmpty: { arity: "nullary", key: "isEmpty", label: "is empty" },
	isNotEmpty: { arity: "nullary", key: "isNotEmpty", label: "is not empty" },
	lt: { arity: "single", key: "lt", label: "is before" },
	lte: { arity: "single", key: "lte", label: "is on or before" },
	neq: { arity: "single", key: "neq", label: "is not" },
	notBetween: { arity: "range", key: "notBetween", label: "is not between" },
	notContains: {
		arity: "single",
		key: "notContains",
		label: "does not contain",
	},
	notIn: { arity: "set", key: "notIn", label: "is none of" },
	startsWith: { arity: "single", key: "startsWith", label: "starts with" },
};

/** Operators available per column type (references into `OPERATOR_DEFS`). */
const OPERATORS: Record<ColumnDataType, FilterOperator[]> = {
	boolean: ["eq", "neq"],
	date: [
		"eq",
		"neq",
		"gt",
		"gte",
		"lt",
		"lte",
		"between",
		"notBetween",
		"isEmpty",
		"isNotEmpty",
	],
	enum: ["eq", "neq", "in", "notIn"],
	multiEnum: ["includeAny", "includeAll", "excludeAny", "excludeAll"],
	number: [
		"eq",
		"neq",
		"gt",
		"gte",
		"lt",
		"lte",
		"between",
		"notBetween",
		"isEmpty",
		"isNotEmpty",
	],
	string: [
		"eq",
		"neq",
		"contains",
		"notContains",
		"startsWith",
		"endsWith",
		"isEmpty",
		"isNotEmpty",
	],
};

/** Explicit default operator per column type (not "first in list"). */
const DEFAULT_OPERATORS: Record<ColumnDataType, FilterOperator> = {
	boolean: "eq",
	date: "eq",
	enum: "eq",
	multiEnum: "includeAll",
	number: "eq",
	string: "eq",
};

export const FILTER_OPERATORS: readonly FilterOperator[] = Object.keys(
	OPERATOR_DEFS,
) as FilterOperator[];

/** Full arity dispatch for nullary / gating / editor checks. */
export function getOperatorArity(operator: FilterOperator): OperatorArity {
	return OPERATOR_DEFS[operator]?.arity ?? "single";
}

export function getOperatorsForType(type: ColumnDataType): FilterOperator[] {
	return [...OPERATORS[type]];
}

export function getOperatorLabel(operator: FilterOperator): string {
	return OPERATOR_DEFS[operator]?.label ?? operator;
}

export function getDefaultOperator(type: ColumnDataType): FilterOperator {
	return DEFAULT_OPERATORS[type];
}

/**
 * Historical short names from stored filters (`include` ≡ `includeAll`,
 * `exclude` ≡ `excludeAll`). Accepted at the serialization boundary only —
 * returns the canonical operator, or `undefined` for unknown strings so
 * callers can report `INVALID_OPERATOR` / `INVALID_FILTER_JSON`.
 */
const LEGACY_OPERATOR_ALIASES: Record<string, FilterOperator> = {
	exclude: "excludeAll",
	include: "includeAll",
};

export function normalizeOperator(raw: string): FilterOperator | undefined {
	if (FILTER_OPERATORS.some((op) => op === raw)) {
		return raw as FilterOperator;
	}
	return LEGACY_OPERATOR_ALIASES[raw];
}
