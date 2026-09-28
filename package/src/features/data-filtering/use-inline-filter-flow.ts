import { useCallback, useMemo, useReducer } from "react";

import { isSearchColumn } from "../../columns.ts";
import type {
	ColumnConfig,
	FilterCondition,
	FilterOperator,
} from "../../types.ts";
import { commitDraft, quickAddCondition } from "./filter-draft.ts";
import { getDefaultOperator, getOperatorArity } from "./operators.ts";

type Phase = "idle" | "column" | "operator" | "value";

/** Read-only draft state. Mutations go through `actions` so the `idle → column → operator → value` machine can't be skipped. */
export interface InlineFilterState {
	/** Last `commitDraft` failure (`"A value is required"`, tuple errors). Cleared on the next successful commit / `reset`. */
	error: string | null;
	inputValue: string;
	needsNullValue: boolean;
	pendingValue: unknown;
	phase: Phase;
	searchText: string;
	selectedColumn: ColumnConfig | undefined;
	selectedColumnId: string | null;
	selectedOperator: FilterOperator | null;
}

/** Guided transitions for the inline filter machine. */
export interface InlineFilterActions {
	clearError: () => void;
	commit: () => void;
	handleColumnSelect: (columnId: string) => void;
	handleInputChange: (value: string) => void;
	handleOperatorSelect: (operator: FilterOperator) => void;
	handleQuickValueSelect: (columnId: string, value: string) => void;
	reset: () => void;
	/** Validated write path for value editors. Prefer this over raw setters. */
	setPendingValue: (value: unknown) => void;
	/**
	 * Plain text setter for the selector search boxes (column / operator
	 * lists). Writes `searchText` only — never drives phase transitions.
	 * The main filter input must go through `handleInputChange`.
	 */
	setSearchText: (value: string) => void;
}

interface FlowState {
	error: string | null;
	inputValue: string;
	pendingValue: unknown;
	phase: Phase;
	searchText: string;
	selectedColumnId: string | null;
	selectedOperator: FilterOperator | null;
}

const INITIAL_FLOW: FlowState = {
	error: null,
	inputValue: "",
	pendingValue: undefined,
	phase: "idle",
	searchText: "",
	selectedColumnId: null,
	selectedOperator: null,
};

type FlowAction =
	| { type: "input"; value: string }
	| { type: "column/missing"; columnId: string }
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
 * decided by the caller before dispatch — the reducer only applies the
 * chosen `column/select`, so there is one column-advance path instead of
 * two near-duplicate actions.
 */
function flowReducer(state: FlowState, action: FlowAction): FlowState {
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
		case "column/missing":
			return { ...state, selectedColumnId: action.columnId };
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

/**
 * Guided `idle → column → operator → value` draft machine for the filter bar.
 *
 * Returns a namespaced `{ state, actions }` pair. `commit()`
 * surfaces validation failures on `state.error` instead of swallowing them.
 *
 * `inputValue` is the main filter input (drives `idle ↔ column`);
 * `searchText` is the selector search box (never drives phases). Typing
 * in the main input seeds `searchText` so the opening selector is
 * pre-filtered; clearing the selector shows all options without closing
 * the popover.
 *
 * @example
 * ```tsx
 * const { state, actions } = useInlineFilterFlow({ columnsConfig, onAdd });
 * // state.phase, state.selectedColumn … actions.handleColumnSelect(id), actions.commit()
 * ```
 */
export function useInlineFilterFlow(opts: {
	columnsConfig: ColumnConfig[];
	onAdd: (condition: FilterCondition) => void;
}): { actions: InlineFilterActions; state: InlineFilterState } {
	const { columnsConfig, onAdd } = opts;

	const [flow, dispatch] = useReducer(flowReducer, INITIAL_FLOW);
	const {
		error,
		inputValue,
		pendingValue,
		phase,
		searchText,
		selectedColumnId,
		selectedOperator,
	} = flow;

	const columnById = useMemo(
		() => new Map(columnsConfig.map((c) => [c.id, c])),
		[columnsConfig],
	);

	const getColumn = useCallback(
		(columnId: string) => columnById.get(columnId),
		[columnById],
	);

	const selectedColumn =
		selectedColumnId !== null ? columnById.get(selectedColumnId) : undefined;

	const needsNullValue =
		selectedOperator !== null &&
		getOperatorArity(selectedOperator) === "nullary";

	const clearError = useCallback(() => dispatch({ type: "clearError" }), []);

	const reset = useCallback(() => dispatch({ type: "reset" }), []);

	const setPendingValue = useCallback(
		(value: unknown) => dispatch({ type: "pending", value }),
		[],
	);

	const setSearchText = useCallback(
		(value: string) => dispatch({ type: "search", value }),
		[],
	);

	const commit = useCallback(() => {
		if (!(selectedColumnId && selectedOperator)) return;

		const result = commitDraft(
			selectedColumnId,
			selectedOperator,
			pendingValue,
			getColumn(selectedColumnId)?.type,
		);
		if (!result.ok) {
			dispatch({ error: result.error, type: "commit/error" });
			return;
		}

		dispatch({ type: "reset" });
		onAdd(result.condition);
	}, [selectedColumnId, selectedOperator, pendingValue, getColumn, onAdd]);

	const commitNullary = useCallback(
		(columnId: string, operator: FilterOperator) => {
			// Route through the single commit policy so nullary validation
			// lives in `filter-draft.ts`, not in a second ad-hoc path.
			const result = commitDraft(columnId, operator, null);
			if (!result.ok) {
				dispatch({ error: result.error, type: "commit/error" });
				return;
			}
			onAdd(result.condition);
			dispatch({ type: "reset" });
		},
		[onAdd],
	);

	const handleInputChange = useCallback(
		(value: string) => dispatch({ type: "input", value }),
		[],
	);

	const handleColumnSelect = useCallback(
		(columnId: string) => {
			const col = getColumn(columnId);
			if (!col) {
				dispatch({ columnId, type: "column/missing" });
				return;
			}

			if (isSearchColumn(columnId)) {
				dispatch({
					columnId,
					operator: "contains",
					phase: "value",
					type: "column/select",
				});
				return;
			}

			const defaultOp = col.operators?.[0] ?? getDefaultOperator(col.type);

			if (getOperatorArity(defaultOp) === "nullary") {
				commitNullary(columnId, defaultOp);
				return;
			}

			dispatch({
				columnId,
				operator: defaultOp,
				phase: "operator",
				type: "column/select",
			});
		},
		[getColumn, commitNullary],
	);

	const handleQuickValueSelect = useCallback(
		(columnId: string, value: string) => {
			const col = getColumn(columnId);
			if (!col) return;

			onAdd(quickAddCondition(col, value));
			dispatch({ type: "reset" });
		},
		[getColumn, onAdd],
	);

	const handleOperatorSelect = useCallback(
		(operator: FilterOperator) => {
			if (!selectedColumnId) return;
			if (getOperatorArity(operator) === "nullary") {
				commitNullary(selectedColumnId, operator);
				return;
			}

			dispatch({ operator, type: "operator" });
		},
		[selectedColumnId, commitNullary],
	);

	const state: InlineFilterState = useMemo(
		() => ({
			error,
			inputValue,
			needsNullValue,
			pendingValue,
			phase,
			searchText,
			selectedColumn,
			selectedColumnId,
			selectedOperator,
		}),
		[
			error,
			inputValue,
			needsNullValue,
			pendingValue,
			phase,
			searchText,
			selectedColumn,
			selectedColumnId,
			selectedOperator,
		],
	);

	const actions: InlineFilterActions = useMemo(
		() => ({
			clearError,
			commit,
			handleColumnSelect,
			handleInputChange,
			handleOperatorSelect,
			handleQuickValueSelect,
			reset,
			setPendingValue,
			setSearchText,
		}),
		[
			clearError,
			commit,
			handleColumnSelect,
			handleInputChange,
			handleOperatorSelect,
			handleQuickValueSelect,
			reset,
			setPendingValue,
			setSearchText,
		],
	);

	return { actions, state };
}
