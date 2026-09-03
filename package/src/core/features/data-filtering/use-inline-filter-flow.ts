import { nanoid } from "nanoid";
import { useCallback, useEffect, useMemo, useState } from "react";

import type {
	ColumnConfig,
	FilterCondition,
	FilterOperator,
} from "../../types.ts";
import { SEARCH_COLUMN_ID } from "../../types.ts";
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

	const needsNullValue = operatorSkipsValue(selectedOperator ?? "eq");

	const reset = useCallback(() => {
		setPhase("idle");
		setSelectedColumnId(null);
		setSelectedOperator(null);
		setPendingValue(undefined);
		setInputValue("");
	}, []);

	const commit = useCallback(() => {
		if (!(selectedColumnId && selectedOperator)) return;

		const value = needsNullValue ? null : pendingValue;
		const hasValue =
			needsNullValue || (value !== undefined && value !== null && value !== "");

		if (!hasValue) return;

		onAdd({
			columnId: selectedColumnId,
			combinator: "and",
			id: nanoid(),
			operator: selectedOperator,
			value,
		});
		reset();
	}, [
		selectedColumnId,
		selectedOperator,
		needsNullValue,
		pendingValue,
		onAdd,
		reset,
	]);

	// Auto-commit for isEmpty/isNotEmpty operators
	useEffect(() => {
		if (phase === "value" && needsNullValue) {
			commit();
		}
	}, [phase, needsNullValue, commit]);

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

	const enterNullValuePhase = useCallback((operator: FilterOperator) => {
		setSelectedOperator(operator);
		setPendingValue(null);
		setPhase("value");
		setInputValue("");
	}, []);

	const handleColumnSelect = useCallback(
		(columnId: string) => {
			setSelectedColumnId(columnId);
			const col = getColumn(columnId);
			if (!col) return;

			if (columnId === SEARCH_COLUMN_ID) {
				setSelectedOperator("contains");
				setPhase("value");
				setInputValue("");
				return;
			}

			const defaultOp = col.operators?.[0] ?? getDefaultOperator(col.type);

			if (operatorSkipsValue(defaultOp)) {
				enterNullValuePhase(defaultOp);
				return;
			}

			setSelectedOperator(defaultOp);
			setPhase("operator");
			setInputValue("");
		},
		[getColumn, enterNullValuePhase],
	);

	const handleQuickValueSelect = useCallback(
		(columnId: string, value: string) => {
			const col = getColumn(columnId);
			if (!col) return;

			onAdd({
				columnId,
				combinator: "and",
				id: nanoid(),
				operator: col.type === "multiEnum" ? "includeAny" : "eq",
				value:
					col.type === "enum" || col.type === "multiEnum" ? [value] : value,
			});
			reset();
		},
		[getColumn, onAdd, reset],
	);

	const handleOperatorSelect = useCallback(
		(operator: FilterOperator) => {
			if (operatorSkipsValue(operator)) {
				enterNullValuePhase(operator);
				return;
			}

			setSelectedOperator(operator);
			setPendingValue(undefined);
			setPhase("value");
			setInputValue("");
		},
		[enterNullValuePhase],
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
