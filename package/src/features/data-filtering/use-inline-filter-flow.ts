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

	const getColumn = useCallback(
		(columnId: string) => columnsConfig.find((c) => c.id === columnId),
		[columnsConfig],
	);

	const selectedColumn = useMemo(
		() => (selectedColumnId ? getColumn(selectedColumnId) : undefined),
		[selectedColumnId, getColumn],
	);

	const needsNullValue =
		selectedOperator !== null && !requiresValue(selectedOperator);

	const reset = useCallback(() => {
		setPhase("idle");
		setSelectedColumnId(null);
		setSelectedOperator(null);
		setPendingValue(undefined);
		setInputValue("");
	}, []);

	const commit = useCallback(() => {
		if (!(selectedColumnId && selectedOperator)) return;

		const result = commitDraft(
			selectedColumnId,
			selectedOperator,
			pendingValue,
			getColumn(selectedColumnId)?.type,
		);
		if (!result.ok) return;

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

	return {
		commit,
		handleColumnSelect,
		handleInputChange,
		handleOperatorSelect,
		handleQuickValueSelect,
		inputValue,
		needsNullValue,
		pendingValue,
		phase,
		reset,
		selectedColumn,
		selectedColumnId,
		selectedOperator,
		setInputValue,
		setPendingValue,
	};
}
