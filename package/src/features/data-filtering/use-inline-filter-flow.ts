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
import { isNullaryOperator, requiresValue } from "./filter-semantics.ts";
import { getDefaultOperator } from "./operators.ts";

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

	const [phase, setPhase] = useState<Phase>("idle");
	const [inputValue, setInputValue] = useState("");
	const [searchText, setSearchText] = useState("");
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
		setSearchText("");
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
			setSearchText(value);
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
				setSearchText("");
				return;
			}

			const defaultOp = col.operators?.[0] ?? getDefaultOperator(col.type);

			if (isNullaryOperator(defaultOp)) {
				commitNullary(columnId, defaultOp);
				return;
			}

			setSelectedOperator(defaultOp);
			setPhase("operator");
			setInputValue("");
			setSearchText("");
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
			if (isNullaryOperator(operator)) {
				commitNullary(selectedColumnId, operator);
				return;
			}

			setSelectedOperator(operator);
			setPendingValue(undefined);
			setPhase("value");
			setInputValue("");
			setSearchText("");
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
		],
	);

	return { actions, state };
}
