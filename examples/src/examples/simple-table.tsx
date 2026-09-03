import { FilterBar, VirtualTable } from "@adityab/data-explorer/ui";

import { ExplorerShell } from "#/components/explorer-shell";
import { TASKS } from "#/lib/tasks";

/**
 * 1 · Simple table — the minimal wiring: `Provider` for state + data,
 * `FilterBar` for the inline column → operator → value flow, and
 * `VirtualTable` for the virtualized grid.
 */
export function SimpleTable() {
	return (
		<ExplorerShell
			description="Provider state, filter bar, and a virtualized table — no manual wiring."
			domain="simple-table"
			source={TASKS}
			title="1 · Simple table"
		>
			<div className="grid gap-3">
				<FilterBar />
				<div className="h-[480px]">
					<VirtualTable />
				</div>
			</div>
		</ExplorerShell>
	);
}
