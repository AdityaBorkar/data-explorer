import type { ColumnDataType, ColumnSemantics } from "../../columns.ts";
import { isSearchColumnId } from "../../columns.ts";
import type { DataExplorerErrorCode } from "../../errors.ts";
import type { FilterOperator } from "../../filters.ts";
import {
	getOperatorArity,
	getOperatorsForType,
	normalizeOperator,
} from "./operators.ts";

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

function isDateLike(value: unknown): boolean {
	if (value instanceof Date) return !Number.isNaN(value.getTime());
	return typeof value === "string" && value.trim() !== "";
}

function isScalarElement(value: unknown): boolean {
	return typeof value === "string" || typeof value === "number";
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
		if (type === "date") {
			return isDateLike(value[0]) && isDateLike(value[1])
				? undefined
				: `Operator "${operator}" on date requires [date, date]`;
		}
		const [min, max] = value;
		return !isBlankValue(min) && !isBlankValue(max)
			? undefined
			: `Operator "${operator}" requires [min, max] tuple`;
	}

	if (arity === "set" || arity === "array") {
		// Empty arrays are legal here (SQL renders `IN ()` as `(1=0)`);
		// the commit path still blocks them via `coerceFilterValue`.
		if (!Array.isArray(value)) {
			return `Operator "${operator}" requires string[] value`;
		}
		return value.every(isScalarElement)
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

export interface ConditionValidationError {
	code: DataExplorerErrorCode;
	details?: Record<string, unknown>;
	message: string;
}

/**
 * Single condition validator shared by the SQL builder (which throws
 * `DataExplorerError` from it) and the column-aware zod schema (which maps
 * it to issues). Branch on the returned `code`, never on message text.
 */
export function validateCondition(
	cond: { columnId: string; operator: string; value: unknown },
	columnsById: Map<string, ColumnSemantics>,
): ConditionValidationError | undefined {
	if (isSearchColumnId(cond.columnId)) {
		if (cond.operator !== "contains") {
			return {
				code: "INVALID_OPERATOR",
				details: { columnId: cond.columnId, operator: cond.operator },
				message: `Invalid operator "${cond.operator}" for search (must be "contains")`,
			};
		}
		if (typeof cond.value !== "string" || cond.value.length === 0) {
			return {
				code: "INVALID_FILTER_VALUE",
				details: { columnId: cond.columnId, operator: cond.operator },
				message: "Search filter requires a non-empty string value",
			};
		}
		return undefined;
	}

	const col = columnsById.get(cond.columnId);
	if (!col) {
		return {
			code: "UNKNOWN_COLUMN",
			details: { columnId: cond.columnId },
			message: `Invalid filter condition: Unknown column "${cond.columnId}"`,
		};
	}

	const canonical = normalizeOperator(cond.operator);
	if (!canonical) {
		return {
			code: "INVALID_OPERATOR",
			details: { columnId: cond.columnId, operator: cond.operator },
			message: `Invalid filter condition: Invalid operator "${cond.operator}" for column "${cond.columnId}"`,
		};
	}
	const valid = col.operators ?? getOperatorsForType(col.type);
	if (!valid.includes(canonical)) {
		return {
			code: "INVALID_OPERATOR",
			details: { columnId: cond.columnId, operator: cond.operator },
			message: `Invalid filter condition: Invalid operator "${cond.operator}" for column "${cond.columnId}"`,
		};
	}
	const error = validateFilterValue(canonical, cond.value, col.type);
	if (error) {
		return {
			code: "INVALID_FILTER_VALUE",
			details: { columnId: cond.columnId, operator: cond.operator },
			message: `Invalid filter condition: ${error}`,
		};
	}
	return undefined;
}
