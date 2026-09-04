import { DataExplorerError } from "../../errors.ts";
import type { ColumnDataType, FilterOperator } from "../../types.ts";
import { getOperatorArity, operatorSkipsValue } from "./operators.ts";

/**
 * Canonical filter semantics: the single module that answers
 * "is this operator + value legal, and what does committing it mean?".
 *
 * `operators.ts` owns the operator catalog (which operators exist per
 * column type); this module owns the policy over that catalog (arity
 * predicates, validation, commit coercion). All callers — the inline
 * flow, chips, the zod schema, the SQL builder — route through here so
 * operator/value rules concentrate behind one seam.
 */

/** Arity check ("is this nullary?"). For UI gating use {@link requiresValue}. */
export function isNullaryOperator(operator: FilterOperator): boolean {
	return getOperatorArity(operator) === "nullary";
}

export function isRangeOperator(operator: FilterOperator): boolean {
	return getOperatorArity(operator) === "range";
}

export function requiresArrayValue(operator: FilterOperator): boolean {
	const arity = getOperatorArity(operator);
	return arity === "set" || arity === "array";
}

/** UI gating ("should I render a value input?"). For arity checks use {@link isNullaryOperator}; for full dispatch use `getOperatorArity`. */
export function requiresValue(operator: FilterOperator): boolean {
	return !operatorSkipsValue(operator);
}

export function validateFilterValue(
	operator: FilterOperator,
	value: unknown,
	type?: ColumnDataType,
): string | undefined {
	if (getOperatorArity(operator) === "nullary") {
		return value === null
			? undefined
			: `Operator "${operator}" requires null value`;
	}

	if (getOperatorArity(operator) === "range") {
		if (!Array.isArray(value) || value.length !== 2) {
			return `Operator "${operator}" requires [min, max] tuple`;
		}
		if (type === "number") {
			return typeof value[0] === "number" && typeof value[1] === "number"
				? undefined
				: `Operator "${operator}" on number requires [number, number]`;
		}
		return undefined;
	}

	if (requiresArrayValue(operator)) {
		return Array.isArray(value)
			? undefined
			: `Operator "${operator}" requires string[] value`;
	}

	return value !== null && value !== undefined && value !== ""
		? undefined
		: `Operator "${operator}" requires a non-null value`;
}

export function isValidOperatorValue(
	operator: FilterOperator,
	value: unknown,
	type?: ColumnDataType,
): boolean {
	return validateFilterValue(operator, value, type) === undefined;
}

export function validateOperatorValue(
	operator: FilterOperator,
	value: unknown,
	type?: ColumnDataType,
): void {
	const error = validateFilterValue(operator, value, type);
	if (error)
		throw new DataExplorerError("INVALID_FILTER_VALUE", error, {
			operator,
		});
}

export interface CoercedFilterValue {
	hasValue: boolean;
	value: unknown;
}

/**
 * Single commit policy for nullary vs valued operators: nullary
 * operators always commit with a null value; everything else commits
 * only when the pending value is non-blank.
 */
export function coerceFilterValue(
	operator: FilterOperator,
	pendingValue: unknown,
): CoercedFilterValue {
	if (operatorSkipsValue(operator)) return { hasValue: true, value: null };
	if (
		pendingValue === undefined ||
		pendingValue === null ||
		pendingValue === "" ||
		(Array.isArray(pendingValue) && pendingValue.length === 0)
	) {
		return { hasValue: false, value: pendingValue };
	}
	if (typeof pendingValue === "string" && pendingValue.trim() === "") {
		return { hasValue: false, value: pendingValue };
	}
	return { hasValue: true, value: pendingValue };
}
