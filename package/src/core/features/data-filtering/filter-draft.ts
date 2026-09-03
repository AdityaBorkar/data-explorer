import { nanoid } from "nanoid";

import type {
	ColumnConfig,
	ColumnDataType,
	FilterCondition,
	FilterOperator,
} from "../../types.ts";
import { isSearchColumn } from "../../types.ts";
import { coerceFilterValue, validateFilterValue } from "./filter-semantics.ts";
import { getOperatorArity, operatorSkipsValue } from "./operators.ts";

/**
 * Filter-draft policy: the single module that decides how a pending
 * `operator + value` becomes a committable `FilterCondition`, which
 * editor the UI should render, and how a committed value displays.
 *
 * The inline flow, `FilterBar`, `FilterChip`, and `ValueInput` are thin
 * callers over this seam; operator/value rules live here (built on the
 * `filter-semantics` module), so commit behavior is testable without
 * React or a table instance.
 */

export type DraftCommit =
	| { condition: FilterCondition; ok: true }
	| { error: string; ok: false };

export function buildDraftCondition(
	columnId: string,
	operator: FilterOperator,
	value: unknown,
): FilterCondition {
	return { columnId, combinator: "and", id: nanoid(), operator, value };
}

/**
 * Coerce a pending value and validate it for the operator. Returns a
 * committable condition, or an error when the draft cannot commit yet
 * (blank value) or fails validation.
 */
export function commitDraft(
	columnId: string,
	operator: FilterOperator,
	pendingValue: unknown,
	type?: ColumnDataType,
): DraftCommit {
	const { hasValue, value } = coerceFilterValue(operator, pendingValue);
	if (!hasValue) return { error: "A value is required", ok: false };
	const error = validateFilterValue(operator, value, type);
	if (error) return { error, ok: false };
	return {
		condition: buildDraftCondition(columnId, operator, value),
		ok: true,
	};
}

/** True when the draft targets the global search column. */
export function isSearchDraft(columnId: string): boolean {
	return isSearchColumn(columnId);
}

export type FilterEditorKind =
	| "single"
	| "range"
	| "multi"
	| "nullary"
	| "search";

/**
 * Single editor table: one function maps `operator + column` to the
 * editor the UI renders. Replaces the `MULTI_VALUE_OPERATORS` set, the
 * `formatDisplayValue` operator re-classification, and the search-column
 * string compares scattered across the filter inputs.
 */
export function editorKind(
	operator: FilterOperator,
	column: Pick<ColumnConfig, "id" | "type">,
): FilterEditorKind {
	if (operatorSkipsValue(operator)) return "nullary";
	if (isSearchColumn(column.id)) return "search";
	const arity = getOperatorArity(operator);
	if (arity === "range") return "range";
	if (arity === "set" || arity === "array") return "multi";
	return "single";
}

/**
 * Single display formatter for committed values. Returns null when
 * there is nothing to render (nullary operators, empty values).
 */
export function formatFilterValue(
	value: unknown,
	operator: FilterOperator,
	column: Pick<ColumnConfig, "options" | "type">,
): string | null {
	if (operatorSkipsValue(operator)) return null;
	if (value === null || value === undefined) return null;

	if (operator === "between" || operator === "notBetween") {
		if (!Array.isArray(value)) return null;
		const [min, max] = value as [unknown, unknown];
		if (min === undefined || min === "" || max === undefined || max === "")
			return null;
		return `${String(min)} – ${String(max)}`;
	}

	if (
		getOperatorArity(operator) === "set" ||
		getOperatorArity(operator) === "array"
	) {
		if (!Array.isArray(value)) return String(value);
		const vals = value as unknown[];
		if (vals.length === 0) return null;
		const labels = vals.map((v) => {
			const opt = column.options?.find((o) => o.value === String(v));
			return opt?.label ?? String(v);
		});
		return labels.length > 2
			? `${labels.slice(0, 2).join(", ")}...`
			: labels.join(", ");
	}

	if (column.type === "boolean") {
		if (value === undefined) return null;
		return value ? "Yes" : "No";
	}

	const str = Array.isArray(value)
		? value.map(String).join(", ")
		: String(value);
	if (str === "") return null;
	return str.length > 20 ? `${str.slice(0, 20)}...` : str;
}
