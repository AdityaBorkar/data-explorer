import type { ColumnDataType, FilterOperator } from "../types.ts";

const NULLARY_OPERATORS: ReadonlySet<FilterOperator> = new Set([
  "isEmpty",
  "isNotEmpty",
]);

const RANGE_OPERATORS: ReadonlySet<FilterOperator> = new Set([
  "between",
  "notBetween",
]);

const SET_OPERATORS: ReadonlySet<FilterOperator> = new Set(["in", "notIn"]);

const ARRAY_OPERATORS: ReadonlySet<FilterOperator> = new Set([
  "include",
  "exclude",
  "includeAny",
  "includeAll",
  "excludeAny",
  "excludeAll",
]);

export function isNullaryOperator(operator: FilterOperator): boolean {
  return NULLARY_OPERATORS.has(operator);
}

export function isRangeOperator(operator: FilterOperator): boolean {
  return RANGE_OPERATORS.has(operator);
}

export function isSetOperator(operator: FilterOperator): boolean {
  return SET_OPERATORS.has(operator);
}

export function isArrayOperator(operator: FilterOperator): boolean {
  return ARRAY_OPERATORS.has(operator);
}

export function isValidOperatorValue(
  operator: FilterOperator,
  value: unknown,
  type?: ColumnDataType,
): boolean {
  if (isNullaryOperator(operator)) return value === null;

  if (isRangeOperator(operator)) {
    if (!Array.isArray(value) || value.length !== 2) return false;
    if (type === "number") {
      return typeof value[0] === "number" && typeof value[1] === "number";
    }
    return true;
  }

  if (isSetOperator(operator) || isArrayOperator(operator)) {
    return Array.isArray(value);
  }

  return value !== null && value !== undefined;
}

export function validateOperatorValue(
  operator: FilterOperator,
  value: unknown,
  type?: ColumnDataType,
): void {
  if (isValidOperatorValue(operator, value, type)) return;

  if (isNullaryOperator(operator)) {
    throw new Error(`Operator "${operator}" requires null value`);
  }
  if (isRangeOperator(operator)) {
    if (type === "number") {
      throw new Error(
        `Operator "${operator}" on number requires [number, number]`,
      );
    }
    throw new Error(`Operator "${operator}" requires [min, max] tuple`);
  }
  if (isSetOperator(operator) || isArrayOperator(operator)) {
    throw new Error(`Operator "${operator}" requires string[] value`);
  }
  throw new Error(`Operator "${operator}" requires a non-null value`);
}
