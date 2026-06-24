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

  const selectedColumn = useMemo(
    () =>
      selectedColumnId
        ? columnsConfig.find((c) => c.id === selectedColumnId)
        : undefined,
    [selectedColumnId, columnsConfig],
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
      if (value.trim().length > 0 && phase === "idle") {
        setPhase("column");
      }
      if (value.trim().length === 0 && phase === "column") {
        setPhase("idle");
      }
    },
    [phase],
  );

  const handleColumnSelect = useCallback(
    (columnId: string) => {
      setSelectedColumnId(columnId);
      const col = columnsConfig.find((c) => c.id === columnId);
      if (!col) return;

      if (columnId === SEARCH_COLUMN_ID) {
        setSelectedOperator("contains");
        setPhase("value");
        setInputValue("");
        return;
      }

      const defaultOp = col.operators?.[0] ?? getDefaultOperator(col.type);
      setSelectedOperator(defaultOp);

      if (operatorSkipsValue(defaultOp)) {
        setPendingValue(null);
        setPhase("value");
        setInputValue("");
        return;
      }

      setPhase("operator");
      setInputValue("");
    },
    [columnsConfig],
  );

  const handleQuickValueSelect = useCallback(
    (columnId: string, value: string) => {
      const col = columnsConfig.find((c) => c.id === columnId);
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
    [columnsConfig, onAdd, reset],
  );

  const handleOperatorSelect = useCallback((operator: FilterOperator) => {
    setSelectedOperator(operator);

    if (operatorSkipsValue(operator)) {
      setPendingValue(null);
      setPhase("value");
      setInputValue("");
      return;
    }

    setPendingValue(undefined);
    setPhase("value");
    setInputValue("");
  }, []);

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
