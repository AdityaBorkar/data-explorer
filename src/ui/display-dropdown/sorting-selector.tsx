import {
  IconArrowsSort,
  IconSortAscending,
  IconSortDescending,
} from "@tabler/icons-react";
import { useCallback } from "react";

import { useTableContext } from "../../core/context.tsx";
import {
  cn,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../primitives/index.ts";

export function SortingSelector() {
  const { table } = useTableContext();

  const visibleColumns = table.getVisibleLeafColumns();
  const sorting = table.state.sorting;
  const current = sorting[0];
  const orderType = current?.desc ? "desc" : "asc";

  const handleSortColumnChange = useCallback(
    (value: string) => {
      table.setSorting([{ desc: current?.desc ?? false, id: value }]);
    },
    [table, current],
  );

  const toggleSortDirection = useCallback(() => {
    if (!current) return;
    table.setSorting([{ desc: !current.desc, id: current.id }]);
  }, [table, current]);

  return (
    <div className="p-3">
      <div className="mb-2 flex items-center gap-1.5 font-medium text-muted-foreground text-xs">
        <IconArrowsSort className="size-3.5" />
        Sort
      </div>
      <div className="flex items-center gap-2">
        <Select
          onValueChange={handleSortColumnChange}
          value={current?.id ?? undefined}
        >
          <SelectTrigger className="h-8 flex-1" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Column</SelectLabel>
              {visibleColumns.map((column) => {
                const meta = column.columnDef.meta;
                return (
                  <SelectItem key={column.id} value={column.id}>
                    {meta?.displayName ?? column.id}
                  </SelectItem>
                );
              })}
            </SelectGroup>
          </SelectContent>
        </Select>
        <button
          aria-label={`Sort ${orderType === "asc" ? "ascending" : "descending"}`}
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-input transition-colors hover:bg-muted",
          )}
          onClick={toggleSortDirection}
          type="button"
        >
          {orderType === "asc" ? (
            <IconSortAscending className="size-4" />
          ) : (
            <IconSortDescending className="size-4" />
          )}
        </button>
      </div>
    </div>
  );
}
