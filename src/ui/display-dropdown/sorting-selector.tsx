import {
  IconArrowsSort,
  IconSortAscending,
  IconSortDescending,
} from "@tabler/icons-react";
import { useCallback, useMemo } from "react";

import { useConfigContext, useDisplayContext } from "../../core/context";
import {
  cn,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../primitives";

export function SortingSelector() {
  const { display, updateDisplay } = useDisplayContext();
  const { columnsConfig } = useConfigContext();

  const visibleColumns = useMemo(
    () => columnsConfig.filter((c) => display.fields.includes(c.id)),
    [columnsConfig, display.fields],
  );

  const handleSortColumnChange = useCallback(
    (value: string | null) => {
      if (value) updateDisplay({ orderBy: value });
    },
    [updateDisplay],
  );

  const toggleSortDirection = useCallback(() => {
    updateDisplay({ orderType: display.orderType === "asc" ? "desc" : "asc" });
  }, [display.orderType, updateDisplay]);

  return (
    <div className="p-3">
      <div className="mb-2 flex items-center gap-1.5 font-medium text-muted-foreground text-xs">
        <IconArrowsSort className="size-3.5" />
        Sort
      </div>
      <div className="flex items-center gap-2">
        <Select onValueChange={handleSortColumnChange} value={display.orderBy}>
          <SelectTrigger className="h-8 flex-1" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Column</SelectLabel>
              {visibleColumns.map((col) => (
                <SelectItem key={col.id} value={col.id}>
                  {col.displayName}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <button
          aria-label={`Sort ${display.orderType === "asc" ? "ascending" : "descending"}`}
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-input transition-colors hover:bg-muted",
          )}
          onClick={toggleSortDirection}
          type="button"
        >
          {display.orderType === "asc" ? (
            <IconSortAscending className="size-4" />
          ) : (
            <IconSortDescending className="size-4" />
          )}
        </button>
      </div>
    </div>
  );
}
