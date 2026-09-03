import type { ColumnDataType, FilterOperator } from "../../types.ts";

export type OperatorArity = "nullary" | "single" | "range" | "set" | "array";

interface OperatorDef {
	arity: OperatorArity;
	key: FilterOperator;
	label: string;
	skipValue?: boolean;
}

const OPERATORS: Record<ColumnDataType, OperatorDef[]> = {
	boolean: [
		{ arity: "single", key: "eq", label: "is" },
		{ arity: "single", key: "neq", label: "is not" },
	],
	date: [
		{ arity: "single", key: "eq", label: "is" },
		{ arity: "single", key: "neq", label: "is not" },
		{ arity: "single", key: "gt", label: "is after" },
		{ arity: "single", key: "gte", label: "is on or after" },
		{ arity: "single", key: "lt", label: "is before" },
		{ arity: "single", key: "lte", label: "is on or before" },
		{ arity: "range", key: "between", label: "is between" },
		{ arity: "range", key: "notBetween", label: "is not between" },
		{
			arity: "nullary",
			key: "isEmpty",
			label: "is empty",
			skipValue: true,
		},
		{
			arity: "nullary",
			key: "isNotEmpty",
			label: "is not empty",
			skipValue: true,
		},
	],
	enum: [
		{ arity: "single", key: "eq", label: "is" },
		{ arity: "single", key: "neq", label: "is not" },
		{ arity: "set", key: "in", label: "is any of" },
		{ arity: "set", key: "notIn", label: "is none of" },
	],
	multiEnum: [
		{ arity: "array", key: "include", label: "includes" },
		{ arity: "array", key: "exclude", label: "excludes" },
		{ arity: "array", key: "includeAny", label: "includes any of" },
		{ arity: "array", key: "includeAll", label: "includes all of" },
		{ arity: "array", key: "excludeAny", label: "excludes if any of" },
		{ arity: "array", key: "excludeAll", label: "excludes if all" },
	],
	number: [
		{ arity: "single", key: "eq", label: "is" },
		{ arity: "single", key: "neq", label: "is not" },
		{ arity: "single", key: "gt", label: "is greater than" },
		{ arity: "single", key: "gte", label: "is greater than or equal to" },
		{ arity: "single", key: "lt", label: "is less than" },
		{ arity: "single", key: "lte", label: "is less than or equal to" },
		{ arity: "range", key: "between", label: "is between" },
		{ arity: "range", key: "notBetween", label: "is not between" },
		{
			arity: "nullary",
			key: "isEmpty",
			label: "is empty",
			skipValue: true,
		},
		{
			arity: "nullary",
			key: "isNotEmpty",
			label: "is not empty",
			skipValue: true,
		},
	],
	string: [
		{ arity: "single", key: "eq", label: "is" },
		{ arity: "single", key: "neq", label: "is not" },
		{ arity: "single", key: "contains", label: "contains" },
		{ arity: "single", key: "notContains", label: "does not contain" },
		{ arity: "single", key: "startsWith", label: "starts with" },
		{ arity: "single", key: "endsWith", label: "ends with" },
		{
			arity: "nullary",
			key: "isEmpty",
			label: "is empty",
			skipValue: true,
		},
		{
			arity: "nullary",
			key: "isNotEmpty",
			label: "is not empty",
			skipValue: true,
		},
	],
};

export const FILTER_OPERATORS: readonly FilterOperator[] = Array.from(
	new Set(Object.values(OPERATORS).flatMap((defs) => defs.map((d) => d.key))),
);

const OPERATOR_DEFS = new Map<FilterOperator, OperatorDef>();
for (const defs of Object.values(OPERATORS)) {
	for (const def of defs) {
		if (!OPERATOR_DEFS.has(def.key)) OPERATOR_DEFS.set(def.key, def);
	}
}

export function operatorSkipsValue(operator: FilterOperator): boolean {
	return OPERATOR_DEFS.get(operator)?.skipValue ?? false;
}

export function getOperatorArity(operator: FilterOperator): OperatorArity {
	return OPERATOR_DEFS.get(operator)?.arity ?? "single";
}

export function getOperatorsForType(type: ColumnDataType): FilterOperator[] {
	return OPERATORS[type].map((d) => d.key);
}

export function getOperatorLabel(operator: FilterOperator): string {
	return OPERATOR_DEFS.get(operator)?.label ?? operator;
}

export function getDefaultOperator(type: ColumnDataType): FilterOperator {
	return OPERATORS[type][0]?.key ?? "eq";
}
