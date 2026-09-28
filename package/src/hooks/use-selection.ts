import type { RowSelectionState } from "@tanstack/react-table";
import { useCallback, useContext, useMemo } from "react";

import { DataExplorerContext } from "../context.tsx";
import { MissingProviderError } from "../errors.ts";

export interface SelectionState {
	/** Ids of all currently loaded rows. Stable unless the underlying data changes. */
	allRowIds: string[];
	/** True when every loaded row is selected. */
	allSelected: boolean;
	clearSelection: () => void;
	/** Row-level membership check for `React.memo` rows (stable callback). */
	isSelected: (id: string) => boolean;
	/** Number of selected rows — prefer over `selectedRowIds.size` in memoized rows. */
	selectedCount: number;
	/** Selected row ids snapshot. Memoized on selection state only. */
	selectedRowIds: Set<string>;
	/** Select every loaded row (pagination scope: only rows already fetched). */
	selectLoadedRows: () => void;
	toggleRowSelection: (id: string) => void;
}

/**
 * Row selection derived from table state.
 *
 * Split memos keep `allRowIds` (O(n) row enumeration) off the selection
 * path and `selectedRowIds` identity stable across data updates, so large
 * tables don't cascade re-renders on every toggle. Row components should
 * consume `isSelected(id)` + `selectedCount` rather than the `Set`.
 *
 * Scope note: `selectLoadedRows` selects loaded pages only, while
 * `clearSelection` (`resetRowSelection`) is global — asymmetric by TanStack
 * design, documented here so it doesn't surprise.
 *
 * @example
 * ```tsx
 * const { selectedCount, isSelected, toggleRowSelection } = useSelectionContext();
 * ```
 */
export function useSelectionContext(): SelectionState {
	const contextValue = useContext(DataExplorerContext);
	if (!contextValue) throw new MissingProviderError("useSelectionContext");
	const { table } = contextValue;
	const rowSelection: RowSelectionState = table.state.rowSelection;

	// Row enumeration runs only when the underlying data changes — never on
	// selection toggles. `table.options.data` is data-driven by design: the
	// table instance is stable while page data swaps underneath it.
	// biome-ignore lint/correctness/useExhaustiveDependencies: data-driven by design
	const allRowIds = useMemo(
		() => table.getRowModel().flatRows.map((row) => row.id),
		[table, table.options.data],
	);

	const selectedRowIds = useMemo(
		() => new Set(Object.keys(rowSelection).filter((id) => rowSelection[id])),
		[rowSelection],
	);

	const selectedCount = selectedRowIds.size;

	const clearSelection = useCallback(() => table.resetRowSelection(), [table]);
	const selectLoadedRows = useCallback(
		() => table.toggleAllRowsSelected(true),
		[table],
	);
	const toggleRowSelection = useCallback(
		(id: string) =>
			table.setRowSelection((prev) => {
				const next = { ...prev };
				if (next[id]) delete next[id];
				else next[id] = true;
				return next;
			}),
		[table],
	);
	const isSelected = useCallback(
		(id: string) => selectedRowIds.has(id),
		[selectedRowIds],
	);

	return useMemo(
		() => ({
			allRowIds,
			allSelected: allRowIds.length > 0 && selectedCount === allRowIds.length,
			clearSelection,
			isSelected,
			selectedCount,
			selectedRowIds,
			selectLoadedRows,
			toggleRowSelection,
		}),
		[
			allRowIds,
			selectedCount,
			clearSelection,
			selectLoadedRows,
			selectedRowIds,
			isSelected,
			toggleRowSelection,
		],
	);
}
