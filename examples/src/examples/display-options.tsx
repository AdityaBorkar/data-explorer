import {
	DisplayColumnSelector,
	DisplayComponent,
	FilterBar,
	SortingSelector,
	SpacingDensitySelector,
	VirtualTable,
} from "@adityab/data-explorer/ui";

import { ExplorerShell } from "#/components/explorer-shell";
import { TASKS } from "#/lib/tasks";

/**
 * 3 · Display options — the `DisplayComponent` popover driving column
 * visibility, sorting, and row density, all owned by the table state.
 */
export function DisplayOptions() {
	return (
		<ExplorerShell
			description="One popover for visible columns, sort order, and density."
			domain="display-options"
			source={TASKS}
			title="3 · Display options"
		>
			<div className="grid gap-3">
				<div className="flex items-center gap-2">
					<div className="min-w-0 flex-1">
						<FilterBar />
					</div>
					<DisplayComponent>
						<DisplayColumnSelector />
						<SortingSelector />
						<SpacingDensitySelector />
					</DisplayComponent>
				</div>
				<div className="h-[480px]">
					<VirtualTable />
				</div>
			</div>
		</ExplorerShell>
	);
}
