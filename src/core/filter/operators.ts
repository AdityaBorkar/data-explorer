import type { ColumnDataType, FilterOperator } from "../types.ts";

interface OperatorDef {
  key: FilterOperator;
  label: string;
  skipValue?: boolean;
}

const OPERATORS: Record<ColumnDataType, OperatorDef[]> = {
  boolean: [
    { key: "eq", label: "is" },
    { key: "neq", label: "is not" },
  ],
  date: [
    { key: "eq", label: "is" },
    { key: "neq", label: "is not" },
    { key: "gt", label: "is after" },
    { key: "gte", label: "is on or after" },
    { key: "lt", label: "is before" },
    { key: "lte", label: "is on or before" },
    { key: "between", label: "is between" },
    { key: "notBetween", label: "is not between" },
    { key: "isEmpty", label: "is empty", skipValue: true },
    { key: "isNotEmpty", label: "is not empty", skipValue: true },
  ],
  enum: [
    { key: "eq", label: "is" },
    { key: "neq", label: "is not" },
    { key: "in", label: "is any of" },
    { key: "notIn", label: "is none of" },
  ],
  multiEnum: [
    { key: "include", label: "includes" },
    { key: "exclude", label: "excludes" },
    { key: "includeAny", label: "includes any of" },
    { key: "includeAll", label: "includes all of" },
    { key: "excludeAny", label: "excludes if any of" },
    { key: "excludeAll", label: "excludes if all" },
  ],
  number: [
    { key: "eq", label: "is" },
    { key: "neq", label: "is not" },
    { key: "gt", label: "is greater than" },
    { key: "gte", label: "is greater than or equal to" },
    { key: "lt", label: "is less than" },
    { key: "lte", label: "is less than or equal to" },
    { key: "between", label: "is between" },
    { key: "notBetween", label: "is not between" },
    { key: "isEmpty", label: "is empty", skipValue: true },
    { key: "isNotEmpty", label: "is not empty", skipValue: true },
  ],
  string: [
    { key: "eq", label: "is" },
    { key: "neq", label: "is not" },
    { key: "contains", label: "contains" },
    { key: "notContains", label: "does not contain" },
    { key: "startsWith", label: "starts with" },
    { key: "endsWith", label: "ends with" },
    { key: "isEmpty", label: "is empty", skipValue: true },
    { key: "isNotEmpty", label: "is not empty", skipValue: true },
  ],
};

export const FILTER_OPERATORS: readonly FilterOperator[] = [
  "eq",
  "neq",
  "contains",
  "notContains",
  "startsWith",
  "endsWith",
  "isEmpty",
  "isNotEmpty",
  "gt",
  "gte",
  "lt",
  "lte",
  "between",
  "notBetween",
  "in",
  "notIn",
  "include",
  "exclude",
  "includeAny",
  "includeAll",
  "excludeAny",
  "excludeAll",
];

const LABEL_MAP = new Map<FilterOperator, string>();
const SKIP_VALUE_SET = new Set<FilterOperator>();
for (const defs of Object.values(OPERATORS)) {
  for (const def of defs) {
    LABEL_MAP.set(def.key, def.label);
    if (def.skipValue) SKIP_VALUE_SET.add(def.key);
  }
}

export function operatorSkipsValue(operator: FilterOperator): boolean {
  return SKIP_VALUE_SET.has(operator);
}

export function getOperatorsForType(type: ColumnDataType): FilterOperator[] {
  return OPERATORS[type].map((d) => d.key);
}

export function getOperatorLabel(operator: FilterOperator): string {
  return LABEL_MAP.get(operator) ?? operator;
}

export function getDefaultOperator(type: ColumnDataType): FilterOperator {
  return OPERATORS[type][0]?.key ?? "eq";
}
