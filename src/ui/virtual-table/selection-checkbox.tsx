import { useCallback } from "react";

import { Checkbox } from "@/components/ui/checkbox";

import { useSelectionContext } from "../../core/context";

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
    (c: boolean) => {
      if (c) selectAll();
      else clearSelection();
    },
    [selectAll, clearSelection],
  );

  return (
    <div className="flex items-center justify-center">
      <Checkbox
        checked={checked}
        indeterminate={indeterminate}
        onCheckedChange={handleChange}
      />
    </div>
  );
}
