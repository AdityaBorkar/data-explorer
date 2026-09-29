import { useCallback, useMemo, useReducer } from "react";

import type { ColumnConfig } from "../../columns.ts";
import type { FilterCondition, FilterOperator } from "../../filters.ts";
import { commitDraft, quickAddCondition } from "./filter-draft.ts";
import {
	type FlowState,
	flowReducer,
	INITIAL_FLOW,
	resolveColumnSelect,
	resolveOperatorSelect,
} from "./filter-flow-reducer.ts";
import { getOperatorArity } from "./operators.ts";

/**
 * Read-only draft state. Mutations go through `actions` so the
 * `idle → column → operator → value` machine can't be skipped.
 * Extends the reducer state with derived selections — one field list,
 * not two parallel interfaces.
 */
export interface InlineFilterState extends FlowState {
	needsNullValue: boolean;
	selectedColumn: ColumnConfig | undefined;
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
 * Column/operator policy lives in `filter-flow-reducer.ts`
 * (`resolveColumnSelect` / `resolveOperatorSelect`) so the hook only
 * applies decisions — one nullary auto-commit path, not three.
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

	// Single commit path: every auto-commit (nullary fast-paths) and the
	// manual `commit()` route through `commitDraft` here, so nullary
	// validation lives in `filter-draft.ts`, not in scattered ad-hoc paths.
	const commitCondition = useCallback(
		(columnId: string, operator: FilterOperator, value: unknown) => {
			const column = columnById.get(columnId);
			const result = commitDraft(columnId, operator, value, column?.type);
			if (!result.ok) {
				dispatch({ error: result.error, type: "commit/error" });
				return;
			}
			onAdd(result.condition);
			dispatch({ type: "reset" });
		},
		[columnById, onAdd],
	);

	// Single nullary auto-commit wrapper so column- and operator-select
	// fast-paths share one `null`-passing site.
	const autoCommitNullary = useCallback(
		(columnId: string, operator: FilterOperator) => {
			commitCondition(columnId, operator, null);
		},
		[commitCondition],
	);

	const commit = useCallback(() => {
		if (!(selectedColumnId && selectedOperator)) return;
		commitCondition(selectedColumnId, selectedOperator, pendingValue);
	}, [selectedColumnId, selectedOperator, pendingValue, commitCondition]);

	const handleInputChange = useCallback(
		(value: string) => dispatch({ type: "input", value }),
		[],
	);

	const handleColumnSelect = useCallback(
		(columnId: string) => {
			const col = columnById.get(columnId);
			if (!col) {
				dispatch({
					error: `Unknown column "${columnId}"`,
					type: "commit/error",
				});
				return;
			}

			const decision = resolveColumnSelect(col);
			if ("autoCommit" in decision) {
				autoCommitNullary(columnId, decision.autoCommit);
				return;
			}

			dispatch({
				columnId,
				operator: decision.operator,
				phase: decision.phase,
				type: "column/select",
			});
		},
		[columnById, autoCommitNullary],
	);

	const handleQuickValueSelect = useCallback(
		(columnId: string, value: string) => {
			const col = columnById.get(columnId);
			if (!col) return;

			onAdd(quickAddCondition(col, value));
			dispatch({ type: "reset" });
		},
		[columnById, onAdd],
	);

	const handleOperatorSelect = useCallback(
		(operator: FilterOperator) => {
			if (!selectedColumnId) return;
			if (resolveOperatorSelect(operator) === "autoCommit") {
				autoCommitNullary(selectedColumnId, operator);
				return;
			}

			dispatch({ operator, type: "operator" });
		},
		[selectedColumnId, autoCommitNullary],
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
