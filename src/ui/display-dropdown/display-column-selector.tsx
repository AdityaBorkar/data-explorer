import { IconLayoutList } from "@tabler/icons-react";

import { useTableContext } from "../../core/context.tsx";
import { Checkbox } from "../primitives/index.ts";

export function DisplayColumnSelector() {
  const { table } = useTableContext();

  const columns = table.getAllLeafColumns();

  return (
    <div className="p-3">
      <div className="mb-2 flex items-center gap-1.5 font-medium text-muted-foreground text-xs">
        <IconLayoutList className="size-3.5" />
        Columns
      </div>
      <div className="flex flex-col gap-1">
        {columns.map((column) => {
          const isVisible = column.getIsVisible();
          const meta = column.columnDef.meta;
          const Icon = meta?.icon as
            | React.ComponentType<{ className?: string }>
            | undefined;
          return (
            // biome-ignore lint/a11y/useSemanticElements: ARIA checkbox wrapping a Radix Checkbox (button); native input not applicable
            <div
              aria-checked={isVisible}
              className="flex cursor-pointer items-center gap-2 rounded-sm px-1 py-0.5 text-sm hover:bg-muted"
              key={column.id}
              onClick={() => column.toggleVisibility(!isVisible)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  column.toggleVisibility(!isVisible);
                }
              }}
              role="checkbox"
              tabIndex={0}
            >
              <Checkbox
                checked={isVisible}
                onCheckedChange={(checked) =>
                  column.toggleVisibility(!!checked)
                }
                tabIndex={-1}
              />
              {Icon && (
                <Icon className="size-3.5 shrink-0 text-muted-foreground" />
              )}
              <span>{meta?.displayName ?? column.id}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
