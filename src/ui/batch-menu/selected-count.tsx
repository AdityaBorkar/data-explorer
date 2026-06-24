import { useSelectionContext } from "@/core/context.tsx";

export function SelectedCount() {
  const { selectedRowIds } = useSelectionContext();

  return (
    <span className="font-medium text-sm">{selectedRowIds.size} selected</span>
  );
}
