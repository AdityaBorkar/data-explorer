import { useSelectionContext } from "@adistack/data-explorer";

export function SelectedCount() {
	const { selectedRowIds } = useSelectionContext();

	return (
		<span className="font-medium text-sm">{selectedRowIds.size} selected</span>
	);
}
