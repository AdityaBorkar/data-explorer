import type { FilterCondition } from "@adistack/data-explorer";
import {
	buildFilterWhere,
	useDataExplorerContext,
} from "@adistack/data-explorer";
import { FilterBar, VirtualTable } from "@adistack/data-explorer-ui";
import { useMemo } from "react";

import { ExplorerShell } from "#/components/explorer-shell";
import {
	TASK_COLUMN_CONFIGS,
	TASK_COLUMN_MAPPING,
	TASKS,
	type Task,
} from "#/lib/tasks";

function SqlPreview() {
	const { table } = useDataExplorerContext<Task>();
	const filters = (table.state.dataFilters ?? []) as FilterCondition[];
	const preview = useMemo(() => {
		try {
			const result = buildFilterWhere(
				filters,
				TASK_COLUMN_CONFIGS,
				TASK_COLUMN_MAPPING,
				{ tableAlias: "tasks" },
			);
			if (result.sql === "") return { params: [], sql: "-- no filters" };
			return result;
		} catch (error) {
			return {
				params: [],
				sql: `-- invalid: ${error instanceof Error ? error.message : String(error)}`,
			};
		}
	}, [filters]);

	return (
		<div className="grid gap-2 rounded-lg border bg-card p-3">
			<p className="font-medium text-xs">
				WHERE{" "}
				{filters.length === 0
					? "(empty)"
					: `(${filters.length} filter${filters.length > 1 ? "s" : ""})`}
			</p>
			<pre className="overflow-auto rounded-md bg-muted p-3 text-xs leading-relaxed">
				<code>{preview.sql}</code>
			</pre>
			<pre className="overflow-auto rounded-md bg-muted p-3 text-xs leading-relaxed">
				<code>{JSON.stringify(preview.params, null, 2)}</code>
			</pre>
		</div>
	);
}

/**
 * 8 · SQL preview — every keystroke in the `FilterBar` rebuilds a
 * parameterized Postgres `WHERE` clause via `buildFilterWhere`
 * (`@adistack/data-explorer`).
 */
export function SqlPreviewExample() {
	return (
		<ExplorerShell
			description="Live filter → parameterized Postgres WHERE translation."
			domain="sql-preview"
			source={TASKS}
			title="8 · SQL preview"
		>
			<div className="grid gap-3">
				<FilterBar />
				<SqlPreview />
				<div className="h-[320px]">
					<VirtualTable />
				</div>
			</div>
		</ExplorerShell>
	);
}
