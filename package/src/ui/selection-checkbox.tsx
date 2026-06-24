import type { Row } from "@tanstack/react-table";
import { useCallback } from "react";

import type { TableFeatures } from "@/core/types";

import { useDataExplorerContext } from "../core/context.tsx";
import { Checkbox } from "./primitives/index.ts";

export function SelectionCheckbox<TItem extends Record<string, unknown>>({
  row,
}: {
  row: Row<TableFeatures, TItem>;
}) {
  const checked = row.getIsSelected();

  const handleChange = useCallback(() => row.toggleSelected(), [row]);

  return (
    <div className="flex items-center justify-center">
      <Checkbox checked={checked} onCheckedChange={handleChange} />
    </div>
  );
}

export function SelectAllCheckbox() {
  const { table } = useDataExplorerContext();

  const checked = table.getIsAllRowsSelected();
  const indeterminate = table.getIsSomeRowsSelected() && !checked;

  const handleChange = useCallback(
    () => table.toggleAllRowsSelected(!checked),
    [table, checked],
  );

  return (
    <div className="flex items-center justify-center">
      <Checkbox
        checked={indeterminate ? "indeterminate" : checked}
        onCheckedChange={handleChange}
      />
    </div>
  );
}
