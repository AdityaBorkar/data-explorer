import type { RowSelectionState } from "@tanstack/react-table";
import { useMemo } from "react";

import { useDataExplorerContext } from "../context.tsx";

export interface SelectionState {
	allRowIds: string[];
	clearSelection: () => void;
	selectAll: () => void;
	selectedRowIds: Set<string>;
	toggleRowSelection: (id: string) => void;
}

export function useSelectionContext(): SelectionState {
	const { table } = useDataExplorerContext();
	const rowSelection: RowSelectionState = table.state.rowSelection;

	return useMemo(() => {
		const selectedRowIds = new Set(
			Object.keys(rowSelection).filter((id) => rowSelection[id]),
		);
		const allRowIds = table.getRowModel().flatRows.map((row) => row.id);

		return {
			allRowIds,
			clearSelection: () => table.resetRowSelection(),
			selectAll: () => table.toggleAllRowsSelected(true),
			selectedRowIds,
			toggleRowSelection: (id: string) =>
				table.setRowSelection((prev) => {
					const next = { ...prev };
					if (next[id]) delete next[id];
					else next[id] = true;
					return next;
				}),
		};
	}, [rowSelection, table]);
}
