import { IconX } from "@tabler/icons-react";
import { useCallback, useState } from "react";

import {
  getOperatorLabel,
  operatorSkipsValue,
} from "../../core/filter/operators";
import type {
  ColumnConfig,
  FilterCondition,
  FilterOperator,
} from "../../core/types";
import { cn, Popover, PopoverContent, PopoverTrigger } from "../primitives";
import { OperatorSelector } from "./operator-selector";
import { ValueInput } from "./value-input";

interface FilterChipProps {
  condition: FilterCondition;
  column: ColumnConfig;
  onUpdate: (id: string, updates: Partial<FilterCondition>) => void;
  onRemove: (id: string) => void;
  selected: boolean;
  onSelect: () => void;
}

export function FilterChip({
  condition,
  column,
  onUpdate,
  onRemove,
  selected,
  onSelect,
}: FilterChipProps) {
  const [editOpen, setEditOpen] = useState(false);
  const Icon = column.icon as
    | React.ComponentType<{ className?: string; strokeWidth?: number }>
    | undefined;
  const operatorLabel = getOperatorLabel(condition.operator);

  const handleRemove = useCallback(
    (e: React.MouseEvent | React.KeyboardEvent) => {
      e.stopPropagation();
      onRemove(condition.id);
    },
    [onRemove, condition.id],
  );

  const handleOperatorChange = useCallback(
    (operator: FilterOperator) => {
      onUpdate(condition.id, {
        operator,
        ...(operatorSkipsValue(operator) ? { value: null } : {}),
      });
    },
    [onUpdate, condition.id],
  );

  const handleValueChange = useCallback(
    (value: unknown) => {
      onUpdate(condition.id, { value });
    },
    [onUpdate, condition.id],
  );

  const displayValue = formatDisplayValue(
    condition.value,
    condition.operator,
    column,
  );

  return (
    <Popover onOpenChange={setEditOpen} open={editOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "inline-flex h-7 items-center gap-1 rounded-md border px-1.5 text-xs transition-colors",
            selected
              ? "border-ring bg-muted"
              : "border-border bg-background hover:bg-muted/50",
          )}
          data-filter-chip={condition.id}
          onClick={onSelect}
          type="button"
        >
          {Icon && (
            <Icon
              className="size-3.5 shrink-0 text-muted-foreground"
              strokeWidth={2.25}
            />
          )}
          <span className="font-medium">{column.displayName}</span>
          <span className="text-muted-foreground">{operatorLabel}</span>
          {displayValue !== null && (
            <span className="max-w-24 truncate">{displayValue}</span>
          )}
          <button
            className="ml-0.5 shrink-0 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
            onClick={handleRemove}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleRemove(e);
              }
            }}
            type="button"
          >
            <IconX className="size-3" />
          </button>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        <div className="flex flex-col gap-2">
          <div className="font-medium text-muted-foreground text-xs">
            {column.displayName}
          </div>
          <OperatorSelector
            column={column}
            onSearchChange={() => {}}
            onSelect={handleOperatorChange}
            search=""
          />
          <ValueInput
            column={column}
            onChange={handleValueChange}
            onCommit={() => setEditOpen(false)}
            operator={condition.operator}
            value={condition.value}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

function formatDisplayValue(
  value: unknown,
  operator: FilterOperator,
  column: ColumnConfig,
): string | null {
  if (operatorSkipsValue(operator)) return null;
  if (value === null || value === undefined) return null;

  if (operator === "between" || operator === "notBetween") {
    const [min, max] = value as [unknown, unknown];
    return `${String(min)} – ${String(max)}`;
  }

  if (operator === "in" || operator === "notIn") {
    const vals = value as string[];
    return vals.length > 2
      ? `${vals.slice(0, 2).join(", ")}...`
      : vals.join(", ");
  }

  if (column.type === "boolean") {
    return value ? "Yes" : "No";
  }

  const str = String(value);
  return str.length > 20 ? `${str.slice(0, 20)}...` : str;
}
