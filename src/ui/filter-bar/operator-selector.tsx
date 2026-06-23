import { useCallback } from "react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

import {
  getOperatorLabel,
  getOperatorsForType,
} from "../../core/filter/operators";
import type { ColumnConfig, FilterOperator } from "../../core/types";

interface OperatorSelectorProps {
  column: ColumnConfig;
  onSelect: (operator: FilterOperator) => void;
  search: string;
  onSearchChange: (value: string) => void;
}

export function OperatorSelector({
  column,
  onSelect,
  search,
  onSearchChange,
}: OperatorSelectorProps) {
  const operators = column.operators ?? getOperatorsForType(column.type);

  const filteredOperators = operators.filter((op) => {
    if (!search.trim()) return true;
    const label = getOperatorLabel(op);
    return label.toLowerCase().includes(search.toLowerCase());
  });

  const handleSelect = useCallback(
    (op: string) => {
      onSelect(op as FilterOperator);
    },
    [onSelect],
  );

  return (
    <Command loop>
      <CommandInput
        onValueChange={onSearchChange}
        placeholder="Select operator..."
        value={search}
      />
      <CommandEmpty>No operator found</CommandEmpty>
      <CommandList className="max-h-48">
        <CommandGroup>
          {filteredOperators.map((op) => (
            <CommandItem key={op} onSelect={() => handleSelect(op)} value={op}>
              <span>{getOperatorLabel(op)}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
