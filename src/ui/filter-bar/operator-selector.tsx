import { useCallback } from "react";

import {
  getOperatorLabel,
  getOperatorsForType,
} from "../../core/filter/operators.ts";
import type { ColumnConfig, FilterOperator } from "../../core/types.ts";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../primitives/index.ts";

interface OperatorSelectorProps {
  column: ColumnConfig;
  onSearchChange: (value: string) => void;
  onSelect: (operator: FilterOperator) => void;
  search: string;
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
    <Command loop={true}>
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
