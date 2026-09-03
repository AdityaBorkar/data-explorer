import {
	type FilterCondition,
	useDataExplorerContext,
} from "@adistack/data-explorer";
import { FilterBar } from "@adistack/data-explorer-ui";

import { ExplorerShell } from "#/components/explorer-shell";
import { TASKS, type Task } from "#/lib/tasks";

function FilterStatePreview() {
	const { table } = useDataExplorerContext<Task>();
	const filters = (table.state.dataFilters ?? []) as FilterCondition[];
	return (
		<div className="grid gap-2">
			<p className="text-muted-foreground text-xs">
				{filters.length === 0
					? "No filters — type in the bar above, pick a column, operator, then value."
					: `${filters.length} active filter${filters.length > 1 ? "s" : ""} (table.state.dataFilters):`}
			</p>
			{filters.length > 0 ? (
				<pre className="overflow-auto rounded-md bg-muted p-3 text-xs">
					{JSON.stringify(filters, null, 2)}
				</pre>
			) : null}
			{filters.length > 0 ? (
				<div>
					<button
						className="rounded-md border border-border px-2 py-1 text-xs transition-colors hover:bg-muted"
						onClick={() => table.clearDataFilters()}
						type="button"
					>
						Clear all
					</button>
				</div>
			) : null}
		</div>
	);
}

/**
 * 2 · Filter bar — the inline filter flow (idle → column → operator →
 * value) with removable chips, and/or combinators, and backspace
 * navigation. The live preview shows the `FilterCondition[]` state.
 */
export function FilterBarExample() {
	return (
		<ExplorerShell
			description="Chips, combinators, and keyboard flow — with the live filter state below."
			domain="filter-bar"
			source={TASKS}
			title="2 · Filter bar"
		>
			<div className="grid gap-3">
				<FilterBar />
				<FilterStatePreview />
			</div>
		</ExplorerShell>
	);
}
