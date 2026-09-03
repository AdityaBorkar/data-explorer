import { useSelectionContext } from "@adityab/data-explorer";
import {
	BatchMenuBar,
	FilterBar,
	SelectedCount,
	VirtualTable,
} from "@adityab/data-explorer/ui";
import { useState } from "react";

import { ExplorerShell } from "#/components/explorer-shell";
import { Button } from "#/components/ui/button";
import { TASKS } from "#/lib/tasks";

function BatchActions() {
	const { clearSelection, selectedRowIds } = useSelectionContext();
	const [lastAction, setLastAction] = useState<string | null>(null);

	return (
		<>
			<BatchMenuBar>
				<SelectedCount />
				<Button
					onClick={() => {
						setLastAction(
							`Marked ${selectedRowIds.size} row${selectedRowIds.size > 1 ? "s" : ""} done`,
						);
						clearSelection();
					}}
					size="sm"
					variant="outline"
				>
					Mark done
				</Button>
				<Button
					onClick={() => {
						setLastAction(
							`Archived ${selectedRowIds.size} row${selectedRowIds.size > 1 ? "s" : ""}`,
						);
						clearSelection();
					}}
					size="sm"
					variant="destructive"
				>
					Archive
				</Button>
			</BatchMenuBar>
			<p className="text-muted-foreground text-xs">
				{lastAction ??
					"Select rows via the checkboxes — the batch bar appears."}
			</p>
		</>
	);
}

/**
 * 4 · Selection & batch menu — row selection state drives a floating
 * `BatchMenuBar`; actions read `selectedRowIds` and clear afterwards.
 */
export function SelectionBatch() {
	return (
		<ExplorerShell
			description="Checkbox selection with a floating batch-action bar."
			domain="selection-batch"
			source={TASKS}
			title="4 · Selection & batch menu"
		>
			<div className="grid gap-3">
				<FilterBar />
				<div className="h-[440px]">
					<VirtualTable />
				</div>
				<BatchActions />
			</div>
		</ExplorerShell>
	);
}
