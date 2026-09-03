import { useDataExplorerContext } from "@adityab/data-explorer";
import { FilterBar, VirtualTable } from "@adityab/data-explorer/ui";

import { ExplorerShell } from "#/components/explorer-shell";
import { BIG_TASKS, type Task } from "#/lib/tasks";

function ScrollStatus() {
	const {
		data: { hasMore, isLoading, isLoadingMore, items },
	} = useDataExplorerContext<Task>();
	return (
		<p className="text-muted-foreground text-xs">
			{isLoading
				? "Loading first page…"
				: `${items.length} rows loaded${hasMore ? " — scroll to the bottom to fetch the next page" : " (end)"}${isLoadingMore ? " — loading more…" : ""}`}
		</p>
	);
}

/**
 * 6 · Infinite scroll — a 500-row list served 20 rows at a time through
 * the `query` builder (cursor pagination + artificial latency). The
 * table's `loadMoreRef` sentinel fetches the next page on scroll.
 */
export function InfiniteScroll() {
	return (
		<ExplorerShell
			delayMs={400}
			description="Cursor-paginated fetching over 500 rows with a loading sentinel."
			domain="infinite-scroll"
			source={BIG_TASKS}
			title="6 · Infinite scroll"
		>
			<div className="grid gap-3">
				<FilterBar />
				<div className="h-[480px]">
					<VirtualTable />
				</div>
				<ScrollStatus />
			</div>
		</ExplorerShell>
	);
}
