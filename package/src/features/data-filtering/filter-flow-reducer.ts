import type { ColumnConfig } from "../../columns.ts";
import { isSearchColumnId } from "../../columns.ts";
import type { FilterOperator } from "../../filters.ts";
import { getDefaultOperator, getOperatorArity } from "./operators.ts";

export type Phase = "idle" | "column" | "operator" | "value";

export interface FlowState {
	error: string | null;
	inputValue: string;
	pendingValue: unknown;
	phase: Phase;
	searchText: string;
	selectedColumnId: string | null;
	selectedOperator: FilterOperator | null;
}

export const INITIAL_FLOW: FlowState = {
	error: null,
	inputValue: "",
	pendingValue: undefined,
	phase: "idle",
	searchText: "",
	selectedColumnId: null,
	selectedOperator: null,
};

export type FlowAction =
	| { type: "input"; value: string }
	| {
			type: "column/select";
			columnId: string;
			operator: FilterOperator;
			phase: "operator" | "value";
	  }
	| { type: "operator"; operator: FilterOperator }
	| { type: "commit/error"; error: string }
	| { type: "pending"; value: unknown }
	| { type: "search"; value: string }
	| { type: "clearError" }
	| { type: "reset" };

/**
 * Single transition table: every phase advance clears the text inputs in
 * one place. Column policy (search fast-path vs default operator) is
 * decided by `resolveColumnSelect` before dispatch — the reducer only
 * applies the chosen `column/select`, so there is one column-advance path.
 */
export function flowReducer(state: FlowState, action: FlowAction): FlowState {
	switch (action.type) {
		case "input": {
			const blank = action.value.trim().length === 0;
			let phase = state.phase;
			if (!blank && phase === "idle") phase = "column";
			else if (blank && phase === "column") phase = "idle";
			return {
				...state,
				inputValue: action.value,
				phase,
				searchText: action.value,
			};
		}
		case "column/select":
			return {
				...state,
				inputValue: "",
				phase: action.phase,
				searchText: "",
				selectedColumnId: action.columnId,
				selectedOperator: action.operator,
			};
		case "operator":
			return {
				...state,
				inputValue: "",
				pendingValue: undefined,
				phase: "value",
				searchText: "",
				selectedOperator: action.operator,
			};
		case "commit/error":
			return { ...state, error: action.error };
		case "pending":
			return { ...state, pendingValue: action.value };
		case "search":
			return { ...state, searchText: action.value };
		case "clearError":
			return { ...state, error: null };
		case "reset":
			return INITIAL_FLOW;
	}
}

export type ColumnSelectDecision =
	| { autoCommit: FilterOperator }
	| { operator: FilterOperator; phase: "operator" | "value" };

/**
 * Pure column-selection policy: search columns pin `contains` and jump to
 * `value`; columns whose default operator is nullary auto-commit with
 * `null`; everything else advances to `operator`. Testable without React.
 */
export function resolveColumnSelect(
	column: ColumnConfig,
): ColumnSelectDecision {
	if (isSearchColumnId(column.id)) {
		return { operator: "contains", phase: "value" };
	}
	const defaultOp = column.operators?.[0] ?? getDefaultOperator(column.type);
	if (getOperatorArity(defaultOp) === "nullary") {
		return { autoCommit: defaultOp };
	}
	return { operator: defaultOp, phase: "operator" };
}

/**
 * Pure operator-selection policy: nullary operators auto-commit with
 * `null`, everything else advances to `value`.
 */
export function resolveOperatorSelect(
	operator: FilterOperator,
): "advance" | "autoCommit" {
	return getOperatorArity(operator) === "nullary" ? "autoCommit" : "advance";
}
