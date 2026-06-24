import { useCallback } from "react";

import { useSelectionContext } from "@/core/context.tsx";
import { Checkbox } from "@/ui/primitives/index.ts";

export function SelectionCheckbox({ rowId }: { rowId: string }) {
  const { selectedRowIds, toggleRowSelection } = useSelectionContext();

  const checked = selectedRowIds.has(rowId);

  const handleChange = useCallback(() => {
    toggleRowSelection(rowId);
  }, [rowId, toggleRowSelection]);

  return (
    <div className="flex items-center justify-center">
      <Checkbox checked={checked} onCheckedChange={handleChange} />
    </div>
  );
}

export function SelectAllCheckbox() {
  const { allRowIds, selectedRowIds, selectAll, clearSelection } =
    useSelectionContext();

  const totalCount = allRowIds.length;
  const selectedCount = selectedRowIds.size;

  const checked = totalCount > 0 && selectedCount === totalCount;
  const indeterminate = selectedCount > 0 && selectedCount < totalCount;

  const handleChange = useCallback(
    (c: boolean | "indeterminate") => {
      if (c) selectAll();
      else clearSelection();
    },
    [selectAll, clearSelection],
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
