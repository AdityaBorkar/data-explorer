import type { ColumnDataType, FilterOperator } from "../../types.ts";
import { getOperatorArity } from "./operators.ts";

/**
 * Canonical filter semantics: the single module that answers
 * "is this operator + value legal, and what does committing it mean?".
 *
 * `operators.ts` owns the operator catalog (which operators exist per
 * column type); this module owns the policy over that catalog
 * (validation, commit coercion). Arity questions ("is this nullary?",
 * "should I render a value input?") go directly to
 * {@link getOperatorArity} so there is one way to ask. All callers —
 * the inline flow, chips, the zod schema, the SQL builder — route
 * through here so operator/value rules concentrate behind one seam.
 */

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

	const arity = getOperatorArity(operator);
	if (arity === "range") {
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

	if (arity === "set" || arity === "array") {
		return Array.isArray(value)
			? undefined
			: `Operator "${operator}" requires string[] value`;
	}

	return value !== null && value !== undefined && value !== ""
		? undefined
		: `Operator "${operator}" requires a non-null value`;
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
	if (getOperatorArity(operator) === "nullary")
		return { hasValue: true, value: null };
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
