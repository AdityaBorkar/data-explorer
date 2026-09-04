import { useCallback, useMemo, useState } from "react";

import type {
	ColumnConfig,
	FilterCondition,
	FilterOperator,
} from "../../types.ts";
import {
	buildDraftCondition,
	commitDraft,
	isSearchDraft,
} from "./filter-draft.ts";
import { requiresValue } from "./filter-semantics.ts";
import { getDefaultOperator, operatorSkipsValue } from "./operators.ts";

type Phase = "idle" | "column" | "operator" | "value";

/** Read-only draft state. Mutations go through `actions` so the `idle → column → operator → value` machine can't be skipped. */
export interface InlineFilterState {
	/** Last `commitDraft` failure (`"A value is required"`, tuple errors). Cleared on the next successful commit / `reset`. */
	error: string | null;
	inputValue: string;
	needsNullValue: boolean;
	pendingValue: unknown;
	phase: Phase;
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
	 * lists). Unlike `handleInputChange` it never drives phase transitions —
	 * the main filter input must go through `handleInputChange`.
	 */
	setSearchText: (value: string) => void;
}

/**
 * Guided `idle → column → operator → value` draft machine for the filter bar.
 *
 * Returns a namespaced `{ state, actions }` pair; the flat legacy keys are
 * still present (deprecated) so existing call sites keep working. `commit()`
 * surfaces validation failures on `state.error` instead of swallowing them.
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
}) {
	const { columnsConfig, onAdd } = opts;

	const [phase, setPhase] = useState<Phase>("idle");
	const [inputValue, setInputValue] = useState("");
	const [selectedColumnId, setSelectedColumnId] = useState<string | null>(null);
	const [selectedOperator, setSelectedOperator] =
		useState<FilterOperator | null>(null);
	const [pendingValue, setPendingValue] = useState<unknown>(undefined);
	const [error, setError] = useState<string | null>(null);

	// O(1) column lookup; pays off past ~50 columns vs a linear scan per select.
	const columnById = useMemo(
		() => new Map(columnsConfig.map((c) => [c.id, c])),
		[columnsConfig],
	);

	const getColumn = useCallback(
		(columnId: string) => columnById.get(columnId),
		[columnById],
	);

	const selectedColumn = useMemo(
		() => (selectedColumnId ? getColumn(selectedColumnId) : undefined),
		[selectedColumnId, getColumn],
	);

	const needsNullValue =
		selectedOperator !== null && !requiresValue(selectedOperator);

	const clearError = useCallback(() => setError(null), []);

	const reset = useCallback(() => {
		setPhase("idle");
		setSelectedColumnId(null);
		setSelectedOperator(null);
		setPendingValue(undefined);
		setInputValue("");
		setError(null);
	}, []);

	const commit = useCallback(() => {
		if (!(selectedColumnId && selectedOperator)) return;

		const result = commitDraft(
			selectedColumnId,
			selectedOperator,
			pendingValue,
			getColumn(selectedColumnId)?.type,
		);
		if (!result.ok) {
			setError(result.error);
			return;
		}

		setError(null);
		onAdd(result.condition);
		reset();
	}, [
		selectedColumnId,
		selectedOperator,
		pendingValue,
		getColumn,
		onAdd,
		reset,
	]);

	const commitNullary = useCallback(
		(columnId: string, operator: FilterOperator) => {
			onAdd(buildDraftCondition(columnId, operator, null));
			reset();
		},
		[onAdd, reset],
	);

	const handleInputChange = useCallback(
		(value: string) => {
			setInputValue(value);
			const isBlank = value.trim().length === 0;
			if (!isBlank && phase === "idle") {
				setPhase("column");
			}
			if (isBlank && phase === "column") {
				setPhase("idle");
			}
		},
		[phase],
	);

	const handleColumnSelect = useCallback(
		(columnId: string) => {
			setSelectedColumnId(columnId);
			const col = getColumn(columnId);
			if (!col) return;

			if (isSearchDraft(columnId)) {
				setSelectedOperator("contains");
				setPhase("value");
				setInputValue("");
				return;
			}

			const defaultOp = col.operators?.[0] ?? getDefaultOperator(col.type);

			if (operatorSkipsValue(defaultOp)) {
				commitNullary(columnId, defaultOp);
				return;
			}

			setSelectedOperator(defaultOp);
			setPhase("operator");
			setInputValue("");
		},
		[getColumn, commitNullary],
	);

	const handleQuickValueSelect = useCallback(
		(columnId: string, value: string) => {
			const col = getColumn(columnId);
			if (!col) return;

			const operator: FilterOperator =
				col.type === "multiEnum" ? "includeAny" : "eq";
			const commitValue = operator === "includeAny" ? [value] : value;
			onAdd(buildDraftCondition(columnId, operator, commitValue));
			reset();
		},
		[getColumn, onAdd, reset],
	);

	const handleOperatorSelect = useCallback(
		(operator: FilterOperator) => {
			if (!selectedColumnId) return;
			if (operatorSkipsValue(operator)) {
				commitNullary(selectedColumnId, operator);
				return;
			}

			setSelectedOperator(operator);
			setPendingValue(undefined);
			setPhase("value");
			setInputValue("");
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
			setSearchText: setInputValue,
		}),
		[
			clearError,
			commit,
			handleColumnSelect,
			handleInputChange,
			handleOperatorSelect,
			handleQuickValueSelect,
			reset,
		],
	);

	return {
		actions,
		/** @deprecated Use `actions.clearError`. */
		clearError,
		// --- Legacy flat surface (deprecated; use `state` / `actions`). ---
		/** @deprecated Use `state` / `actions`. */
		commit,
		/** @deprecated Use `state.error`. */
		error,
		/** @deprecated Use `actions.handleColumnSelect`. */
		handleColumnSelect,
		/** @deprecated Use `actions.handleInputChange`. */
		handleInputChange,
		/** @deprecated Use `actions.handleOperatorSelect`. */
		handleOperatorSelect,
		/** @deprecated Use `actions.handleQuickValueSelect`. */
		handleQuickValueSelect,
		/** @deprecated Use `state.inputValue`. */
		inputValue,
		/** @deprecated Use `state.needsNullValue`. */
		needsNullValue,
		/** @deprecated Use `state.pendingValue`. */
		pendingValue,
		/** @deprecated Use `state.phase`. */
		phase,
		/** @deprecated Use `actions.reset`. */
		reset,
		/** @deprecated Use `state.selectedColumn`. */
		selectedColumn,
		/** @deprecated Use `state.selectedColumnId`. */
		selectedColumnId,
		/** @deprecated Use `state.selectedOperator`. */
		selectedOperator,
		/** @deprecated Internal — input changes go through `actions.handleInputChange`. */
		setInputValue,
		/** @deprecated Use `actions.setPendingValue`. */
		setPendingValue,
		state,
	};
}
