import { IconLayoutList } from "@tabler/icons-react";
import { useCallback } from "react";

import { useConfigContext, useDisplayContext } from "../../core/context";
import { Checkbox } from "../primitives";

export function DisplayColumnSelector() {
  const { display, updateDisplay } = useDisplayContext();
  const { columnsConfig } = useConfigContext();

  const toggleColumn = useCallback(
    (columnId: string, checked: boolean) => {
      const current = display.fields;
      if (checked) {
        if (current.includes(columnId)) return;
        updateDisplay({ fields: [...current, columnId] });
      } else {
        updateDisplay({ fields: current.filter((id) => id !== columnId) });
      }
    },
    [display.fields, updateDisplay],
  );

  return (
    <div className="p-3">
      <div className="mb-2 flex items-center gap-1.5 font-medium text-muted-foreground text-xs">
        <IconLayoutList className="size-3.5" />
        Columns
      </div>
      <div className="flex flex-col gap-1">
        {columnsConfig.map((col) => {
          const isVisible = display.fields.includes(col.id);
          const Icon = col.icon as
            | React.ComponentType<{ className?: string }>
            | undefined;
          return (
            // biome-ignore lint/a11y/useSemanticElements: ARIA checkbox wrapping a Radix Checkbox (button); native input not applicable
            <div
              aria-checked={isVisible}
              className="flex cursor-pointer items-center gap-2 rounded-sm px-1 py-0.5 text-sm hover:bg-muted"
              key={col.id}
              onClick={() => toggleColumn(col.id, !isVisible)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleColumn(col.id, !isVisible);
                }
              }}
              role="checkbox"
              tabIndex={0}
            >
              <Checkbox
                checked={isVisible}
                onCheckedChange={(checked) => toggleColumn(col.id, !!checked)}
                tabIndex={-1}
              />
              {Icon && (
                <Icon className="size-3.5 shrink-0 text-muted-foreground" />
              )}
              <span>{col.displayName}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
