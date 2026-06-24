import { useMemo } from "react";

import type { ColumnConfig } from "../../core/types.ts";
import { SEARCH_COLUMN_ID } from "../../core/types.ts";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../primitives/index.ts";

interface ColumnSelectorProps {
  columns: ColumnConfig[];
  onQuickValueSelect?: (columnId: string, value: string) => void;
  onSearchChange: (value: string) => void;
  onSelect: (columnId: string) => void;
  search: string;
}

export function ColumnSelector({
  columns,
  search,
  onSearchChange,
  onSelect,
  onQuickValueSelect,
}: ColumnSelectorProps) {
  const filteredColumns = useMemo(() => {
    if (!search.trim()) return columns;
    const lower = search.toLowerCase();
    return columns.filter(
      (c) =>
        c.displayName.toLowerCase().includes(lower) ||
        c.id.toLowerCase().includes(lower),
    );
  }, [columns, search]);

  const enumColumns = useMemo(
    () => columns.filter((c) => c.type === "enum" || c.type === "multiEnum"),
    [columns],
  );

  const quickMatches = useMemo(() => {
    if (!search.trim() || search.trim().length < 2) return [];
    const lower = search.toLowerCase();
    const matches: {
      columnId: string;
      columnDisplayName: string;
      option: { label: string; value: string };
    }[] = [];

    for (const col of enumColumns) {
      const opts: { label: string; value: string }[] = col.options ?? [];
      for (const opt of opts) {
        if (
          opt.label.toLowerCase().includes(lower) ||
          opt.value.toLowerCase().includes(lower)
        ) {
          matches.push({
            columnDisplayName: col.displayName,
            columnId: col.id,
            option: opt,
          });
        }
      }
    }
    return matches;
  }, [search, enumColumns]);

  return (
    <Command
      filter={(value, term) =>
        value.toLowerCase().includes(term.toLowerCase()) ? 1 : 0
      }
      loop={true}
    >
      <CommandInput
        onValueChange={onSearchChange}
        placeholder="Filter columns..."
        value={search}
      />
      <CommandEmpty>No columns found</CommandEmpty>
      <CommandList className="max-h-64">
        <CommandGroup heading="Columns">
          {filteredColumns.map((col) => {
            const Icon = col.icon as
              | React.ComponentType<{
                  className?: string;
                  strokeWidth?: number;
                }>
              | undefined;
            return (
              <CommandItem
                key={col.id}
                keywords={[col.displayName]}
                onSelect={() => onSelect(col.id)}
                value={col.id}
              >
                <div className="flex w-full items-center gap-1.5">
                  {Icon && (
                    <Icon className="size-4 shrink-0" strokeWidth={2.25} />
                  )}
                  <span>{col.displayName}</span>
                  {col.id === SEARCH_COLUMN_ID && (
                    <span className="ml-auto text-muted-foreground text-xs">
                      Search all
                    </span>
                  )}
                </div>
              </CommandItem>
            );
          })}
        </CommandGroup>
        {quickMatches.length > 0 && (
          <CommandGroup heading="Quick values">
            {quickMatches.map((m) => (
              <CommandItem
                key={`${m.columnId}-${m.option.value}`}
                keywords={[m.option.label, m.columnDisplayName]}
                onSelect={() =>
                  onQuickValueSelect?.(m.columnId, m.option.value)
                }
                value={`${m.columnId}-${m.option.value}`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">
                    {m.columnDisplayName}
                  </span>
                  <span className="text-muted-foreground/75">&rarr;</span>
                  <span>{m.option.label}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </Command>
  );
}
