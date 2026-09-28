import { nanoid } from "nanoid";

import type { ColumnDataType } from "./columns.ts";

/**
 * All filter operators. `include` ≡ `includeAll` and `exclude` ≡
 * `excludeAll` (historical duplicates, kept for stored filters).
 * Prefer `includeAll` / `excludeAll` in new code.
 */
export type FilterOperator =
	| "eq"
	| "neq"
	| "contains"
	| "notContains"
	| "startsWith"
	| "endsWith"
	| "isEmpty"
	| "isNotEmpty"
	| "gt"
	| "gte"
	| "lt"
	| "lte"
	| "between"
	| "notBetween"
	| "in"
	| "notIn"
	| "include"
	| "exclude"
	| "includeAny"
	| "includeAll"
	| "excludeAny"
	| "excludeAll";

/** A single committed filter predicate. Stored shape; see {@link createFilter} for a typed constructor. */
export interface FilterCondition {
	columnId: string;
	combinator: "and" | "or";
	id: string;
	operator: FilterOperator;
	value: unknown;
}

export interface FilterGroup {
	combinator: "and" | "or";
	conditions: (FilterCondition | FilterGroup)[];
	id: string;
}

export function isFilterGroup(item: unknown): item is FilterGroup {
	return (
		typeof item === "object" &&
		item !== null &&
		"conditions" in item &&
		Array.isArray((item as FilterGroup).conditions)
	);
}

export interface SerializedFilterCondition {
	b: "and" | "or";
	c: string;
	i: string;
	o: FilterOperator;
	v: unknown;
}

/** True when at least one filter condition is present. */
export function hasFilters(conditions: readonly FilterCondition[]): boolean {
	return conditions.length > 0;
}

/**
 * Value shape per column type for editor autocomplete. The stored shape
 * stays {@link FilterCondition} (`value: unknown`); this only types the
 * constructor argument of {@link createFilter}.
 */
export type TypedFilterValue<T extends ColumnDataType> = T extends "number"
	? number | [number, number] | null
	: T extends "boolean"
		? boolean | null
		: T extends "date"
			? string | [string, string] | null
			: unknown;

/**
 * Typed `FilterCondition` constructor — autocomplete for the value shape
 * without changing the stored (serializable) representation.
 *
 * @example
 * ```ts
 * createFilter<"number">("estimate", "between", [1, 5]);
 * createFilter("title", "contains", "polish"); // untyped columns stay `unknown`
 * ```
 */
export function createFilter<T extends ColumnDataType = "string">(
	columnId: string,
	operator: FilterOperator,
	value: TypedFilterValue<T>,
): FilterCondition {
	return { columnId, combinator: "and", id: nanoid(), operator, value };
}
