import { IconFilterX, IconSearch } from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { useConfigContext, useFilterContext } from "../../core/context";
import { operatorSkipsValue } from "../../core/filter/operators";
import { useInlineFilterFlow } from "../../core/filter/use-inline-filter-flow";
import { SEARCH_COLUMN_ID } from "../../core/types";
import { ColumnSelector } from "./column-selector";
import { FilterChipGroup } from "./filter-chip-group";
import { OperatorSelector } from "./operator-selector";
import { ValueInput } from "./value-input";

export function FilterBar({ className }: { className?: string }) {
  const { columnsConfig } = useConfigContext();
  const {
    addFilter,
    filterConditions,
    clearFilters,
    removeFilter,
    updateFilter,
  } = useFilterContext();

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [popoverOpen, setPopoverOpen] = useState(false);
  const [focusedChipIndex, setFocusedChipIndex] = useState<number | null>(null);

  const flow = useInlineFilterFlow({
    columnsConfig,
    onAdd: addFilter,
  });

  useEffect(() => {
    if (flow.phase === "column") setPopoverOpen(true);
    if (flow.phase === "idle") setPopoverOpen(false);
  }, [flow.phase]);

  const resetFlow = useCallback(() => {
    flow.reset();
    setPopoverOpen(false);
    inputRef.current?.focus();
  }, [flow.reset]);

  const commitCondition = useCallback(() => {
    flow.commit();
    setPopoverOpen(false);
    inputRef.current?.focus();
  }, [flow.commit]);

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowLeft") {
        const target = e.currentTarget;
        if (
          target.selectionStart === 0 &&
          target.selectionEnd === 0 &&
          filterConditions.length > 0
        ) {
          e.preventDefault();
          const newIdx =
            focusedChipIndex === null
              ? filterConditions.length - 1
              : Math.max(0, focusedChipIndex - 1);
          setFocusedChipIndex(newIdx);
          return;
        }
      }

      if (e.key === "ArrowRight" && focusedChipIndex !== null) {
        e.preventDefault();
        if (focusedChipIndex < filterConditions.length - 1) {
          setFocusedChipIndex(focusedChipIndex + 1);
        } else {
          setFocusedChipIndex(null);
          inputRef.current?.focus();
        }
        return;
      }

      if (
        (e.key === "Backspace" || e.key === "Delete") &&
        focusedChipIndex !== null
      ) {
        e.preventDefault();
        const cond = filterConditions[focusedChipIndex];
        if (cond) {
          removeFilter(cond.id);
          if (filterConditions.length <= 1) {
            setFocusedChipIndex(null);
            inputRef.current?.focus();
          } else if (focusedChipIndex >= filterConditions.length - 1) {
            setFocusedChipIndex(filterConditions.length - 2);
          }
        }
        return;
      }

      if (
        e.key === "Backspace" &&
        flow.inputValue === "" &&
        filterConditions.length > 0 &&
        focusedChipIndex === null
      ) {
        e.preventDefault();
        setFocusedChipIndex(filterConditions.length - 1);
        return;
      }

      if (e.key === "Enter" && focusedChipIndex !== null) {
        e.preventDefault();
        const chipEl = containerRef.current?.querySelector(
          `[data-filter-chip="${filterConditions[focusedChipIndex]?.id}"]`,
        );
        if (chipEl instanceof HTMLElement) chipEl.click();
        return;
      }

      if (e.key === "Escape") {
        if (popoverOpen) {
          resetFlow();
          return;
        }
        setFocusedChipIndex(null);
        return;
      }

      if (focusedChipIndex !== null && e.key.length === 1) {
        setFocusedChipIndex(null);
      }
    },
    [
      filterConditions,
      removeFilter,
      focusedChipIndex,
      flow.inputValue,
      popoverOpen,
      resetFlow,
    ],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        inputRef.current?.focus();
        setFocusedChipIndex(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (focusedChipIndex !== null) {
      const chipEl = containerRef.current?.querySelector(
        `[data-filter-chip="${filterConditions[focusedChipIndex]?.id}"]`,
      );
      if (chipEl instanceof HTMLElement) chipEl.focus();
    }
  }, [focusedChipIndex, filterConditions]);

  const handleClearAll = useCallback(
    (e: React.MouseEvent | React.KeyboardEvent) => {
      e.stopPropagation();
      clearFilters();
      setFocusedChipIndex(null);
      inputRef.current?.focus();
    },
    [clearFilters],
  );

  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget || e.target === containerRef.current) {
      inputRef.current?.focus();
      setFocusedChipIndex(null);
    }
  }, []);

  const handleCombinatorChange = useCallback(
    (index: number, combinator: "and" | "or") => {
      const cond = filterConditions[index];
      if (cond) {
        updateFilter(cond.id, { combinator });
      }
    },
    [filterConditions, updateFilter],
  );

  const popoverContent = useMemo(() => {
    if (flow.phase === "column") {
      return (
        <ColumnSelector
          columns={columnsConfig}
          onQuickValueSelect={(colId, val) => {
            flow.handleQuickValueSelect(colId, val);
            setPopoverOpen(false);
            inputRef.current?.focus();
          }}
          onSearchChange={flow.setInputValue}
          onSelect={(colId) => {
            flow.handleColumnSelect(colId);
            if (colId === SEARCH_COLUMN_ID) setPopoverOpen(false);
          }}
          search={flow.inputValue}
        />
      );
    }

    if (flow.phase === "operator" && flow.selectedColumn) {
      return (
        <OperatorSelector
          column={flow.selectedColumn}
          onSearchChange={flow.setInputValue}
          onSelect={(op) => {
            flow.handleOperatorSelect(op);
            if (operatorSkipsValue(op)) {
              setPopoverOpen(false);
              inputRef.current?.focus();
            }
          }}
          search={flow.inputValue}
        />
      );
    }

    if (
      flow.phase === "value" &&
      flow.selectedColumn &&
      flow.selectedOperator &&
      !flow.needsNullValue
    ) {
      return (
        <div className="p-2">
          <div className="mb-2 text-muted-foreground text-xs">
            {flow.selectedColumn.displayName}{" "}
            {flow.selectedOperator === "contains" &&
            flow.selectedColumnId === SEARCH_COLUMN_ID
              ? "contains"
              : `— enter value`}
          </div>
          <ValueInput
            column={flow.selectedColumn}
            onChange={flow.setPendingValue}
            onCommit={commitCondition}
            operator={flow.selectedOperator}
            value={flow.pendingValue}
          />
          <div className="mt-2 flex justify-end">
            <button
              className="rounded-md bg-primary px-3 py-1 text-primary-foreground text-xs"
              onClick={commitCondition}
              type="button"
            >
              Apply
            </button>
          </div>
        </div>
      );
    }

    return null;
  }, [
    flow.phase,
    flow.selectedColumn,
    flow.selectedOperator,
    flow.needsNullValue,
    flow.selectedColumnId,
    flow.inputValue,
    flow.pendingValue,
    flow.setPendingValue,
    flow.setInputValue,
    flow.handleColumnSelect,
    flow.handleOperatorSelect,
    flow.handleQuickValueSelect,
    columnsConfig,
    commitCondition,
  ]);

  return (
    <div className={className}>
      <div
        aria-expanded={popoverOpen}
        aria-label="Filter conditions"
        className={cn(
          "flex h-9 w-full min-w-0 items-center gap-1 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs transition-colors",
          "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
          "placeholder:text-muted-foreground",
        )}
        data-slot="filter-bar"
        onClick={handleContainerClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.focus();
          }
        }}
        ref={containerRef}
        role="combobox"
      >
        <IconSearch className="size-4 shrink-0 text-muted-foreground" />

        <FilterChipGroup
          columnsConfig={columnsConfig}
          conditions={filterConditions}
          focusedChipIndex={focusedChipIndex}
          handleCombinatorChange={handleCombinatorChange}
          removeCondition={removeFilter}
          setFocusedChipIndex={setFocusedChipIndex}
          updateCondition={updateFilter}
        />

        <input
          aria-label="Filter input"
          className="min-w-0 grow bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          onChange={(e) => flow.handleInputChange(e.target.value)}
          onFocus={() => setFocusedChipIndex(null)}
          onKeyDown={handleInputKeyDown}
          placeholder={
            filterConditions.length > 0 ? "Filter..." : "Filter (Ctrl+F)"
          }
          ref={inputRef}
          value={flow.inputValue}
        />

        {filterConditions.length > 0 && (
          <button
            aria-label="Clear all filters"
            className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
            onClick={handleClearAll}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleClearAll(e);
              }
            }}
            type="button"
          >
            <IconFilterX className="size-4" />
          </button>
        )}
      </div>

      <Popover
        onOpenChange={(open) => {
          setPopoverOpen(open);
          if (!open) flow.reset();
        }}
        open={popoverOpen}
      >
        <PopoverTrigger className="sr-only" tabIndex={-1} />
        <PopoverContent align="start" className="w-80 p-0" side="bottom">
          {popoverContent}
        </PopoverContent>
      </Popover>
    </div>
  );
}
