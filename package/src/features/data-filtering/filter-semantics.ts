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

/**
 * Shared blank check for valued operators: `null`, `undefined`, empty
 * strings (including whitespace-only), and empty arrays all mean "no value
 * yet". Single source so `validateFilterValue` and `coerceFilterValue`
 * can't disagree about what commits.
 */
function isBlankValue(value: unknown): boolean {
	if (value === undefined || value === null) return true;
	if (typeof value === "string") return value.trim() === "";
	if (Array.isArray(value)) return value.length === 0;
	return false;
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
		// Empty arrays are legal here (SQL renders `IN ()` as `(1=0)`);
		// the commit path still blocks them via `coerceFilterValue`.
		return Array.isArray(value)
			? undefined
			: `Operator "${operator}" requires string[] value`;
	}

	return !isBlankValue(value)
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
	if (isBlankValue(pendingValue)) {
		return { hasValue: false, value: pendingValue };
	}
	return { hasValue: true, value: pendingValue };
}
