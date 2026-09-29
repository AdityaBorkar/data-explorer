import { nanoid } from "nanoid";

import type { ColumnConfig, ColumnDataType } from "../../columns.ts";
import { isSearchColumnId, SEARCH_COLUMN_ID } from "../../columns.ts";
import type { FilterCondition, FilterOperator } from "../../filters.ts";
import { coerceFilterValue, validateFilterValue } from "./filter-semantics.ts";
import { getOperatorArity } from "./operators.ts";

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
 * Build a global-search condition without hand-rolling the `_search`
 * divergence (`contains` operator, value phase, `ILIKE … OR …` fan-out).
 *
 * @example
 * ```ts
 * onAdd(createSearchFilter("polish"));
 * ```
 */
export function createSearchFilter(term: string): FilterCondition {
	return buildDraftCondition(SEARCH_COLUMN_ID, "contains", term);
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

/**
 * Quick-add policy for single-click value selection: uses the column's
 * `quickOperator` when set, otherwise `multiEnum` columns commit an
 * `includeAny` array and everything else commits a scalar `eq`. Array-arity
 * operators wrap the value; scalar operators commit it directly. Lives
 * here (not in the React flow) so the operator choice stays with the rest
 * of the draft policy and is testable without React.
 */
export function quickAddCondition(
	column: Pick<ColumnConfig, "id" | "quickOperator" | "type">,
	value: string,
): FilterCondition {
	const operator: FilterOperator =
		column.quickOperator ?? (column.type === "multiEnum" ? "includeAny" : "eq");
	const arity = getOperatorArity(operator);
	return buildDraftCondition(
		column.id,
		operator,
		arity === "set" || arity === "array" ? [value] : value,
	);
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
	const arity = getOperatorArity(operator);
	if (arity === "nullary") return "nullary";
	if (isSearchColumnId(column.id)) return "search";
	if (arity === "range") return "range";
	if (arity === "set" || arity === "array") return "multi";
	return "single";
}

const DEFAULT_MAX_INLINE_LABELS = 2;
const DEFAULT_MAX_INLINE_CHARS = 20;

/** Truncation budget for `formatFilterValue`. Defaults preserve historical output. */
export interface FormatFilterValueOptions {
	/** Max scalar chars before `...`. @default 20 */
	maxInlineChars?: number;
	/** Max array labels before `...`. @default 2 */
	maxInlineLabels?: number;
}

function formatRangeValue(value: unknown): string | null {
	if (!Array.isArray(value)) return null;
	const [min, max] = value;
	if (min === undefined || min === "" || max === undefined || max === "")
		return null;
	return `${String(min)} – ${String(max)}`;
}

function formatSetValue(
	value: unknown,
	column: Pick<ColumnConfig, "options" | "type">,
	maxInlineLabels: number,
): string | null {
	// Committed set/array values are always arrays (see `commitDraft`);
	// anything else has nothing to render.
	if (!Array.isArray(value)) return null;
	if (value.length === 0) return null;
	const labels = value.map((v) => {
		const opt = column.options?.find((o) => o.value === String(v));
		return opt?.label ?? String(v);
	});
	return labels.length > maxInlineLabels
		? `${labels.slice(0, maxInlineLabels).join(", ")}...`
		: labels.join(", ");
}

function formatScalarValue(
	value: unknown,
	column: Pick<ColumnConfig, "options" | "type">,
	maxInlineChars: number,
): string | null {
	if (column.type === "boolean") {
		if (value === true) return "Yes";
		if (value === false) return "No";
		return null;
	}

	const str = Array.isArray(value)
		? value.map(String).join(", ")
		: String(value);
	if (str === "") return null;
	return str.length > maxInlineChars
		? `${str.slice(0, maxInlineChars)}...`
		: str;
}

/**
 * Single display formatter for committed values. Returns null when
 * there is nothing to render (nullary operators, empty values).
 * Truncation is configurable via `opts` so UI callers own the budget —
 * the headless default preserves historical output.
 */
export function formatFilterValue(
	value: unknown,
	operator: FilterOperator,
	column: Pick<ColumnConfig, "options" | "type">,
	opts?: FormatFilterValueOptions,
): string | null {
	if (getOperatorArity(operator) === "nullary") return null;
	if (value === null || value === undefined) return null;

	const maxInlineLabels = opts?.maxInlineLabels ?? DEFAULT_MAX_INLINE_LABELS;
	const maxInlineChars = opts?.maxInlineChars ?? DEFAULT_MAX_INLINE_CHARS;

	if (operator === "between" || operator === "notBetween") {
		return formatRangeValue(value);
	}

	const arity = getOperatorArity(operator);
	if (arity === "set" || arity === "array") {
		return formatSetValue(value, column, maxInlineLabels);
	}

	return formatScalarValue(value, column, maxInlineChars);
}
