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

export function isFilterGroup(
	item: FilterCondition | FilterGroup,
): item is FilterGroup {
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
