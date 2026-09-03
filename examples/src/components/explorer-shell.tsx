import {
	type FilterViewDisplay,
	Provider,
	type TableFeatures,
	type ViewAdapter,
} from "@adityab/data-explorer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { type ReactNode, useMemo, useState } from "react";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "#/components/ui/card";
import {
	createMemoryQuery,
	DEFAULT_DISPLAY,
	TASK_COLUMNS,
	type Task,
} from "#/lib/tasks";

/**
 * Shared demo shell — the equivalent of the forms `ExampleForm` wrapper.
 * Provides a `QueryClient`, wires the `Provider` to the in-memory task
 * list, and frames the demo in a card. Demos render their toolbar and
 * views as children so they run inside the provider context.
 */
export function ExplorerShell({
	children,
	columns = TASK_COLUMNS,
	defaultDisplay = DEFAULT_DISPLAY,
	delayMs,
	description,
	domain,
	onMove,
	source,
	title,
	viewAdapter,
}: {
	children: ReactNode;
	columns?: ColumnDef<TableFeatures, Task>[];
	defaultDisplay?: FilterViewDisplay;
	delayMs?: number;
	description: string;
	domain: string;
	onMove?: (args: {
		itemId: string;
		fromGroup: string;
		toGroup: string;
		columnId: string;
	}) => void;
	source: Task[];
	title: string;
	viewAdapter?: ViewAdapter;
}) {
	const [client] = useState(() => new QueryClient());
	const query = useMemo(
		() => createMemoryQuery(source, delayMs ? { delayMs } : undefined),
		// `source` identity changes when a demo edits rows (board drag);
		// rebuilding the query keeps the closure over the latest rows.
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[source, delayMs],
	);

	return (
		<Card className="w-full">
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				<CardDescription>{description}</CardDescription>
			</CardHeader>
			<CardContent>
				<QueryClientProvider client={client}>
					<Provider
						columns={columns}
						defaultDisplay={defaultDisplay}
						domain={domain}
						getRowId={(row) => (row as Task).id}
						onMove={
							onMove
								? (args) => {
										onMove(args);
										// The in-memory rows changed — refetch so the new
										// closure over `source` is read on the next fetch.
										void client.invalidateQueries({
											queryKey: ["data-explorer", domain],
										});
									}
								: undefined
						}
						query={query}
						{...(viewAdapter ? { viewAdapter } : {})}
					>
						{children}
					</Provider>
				</QueryClientProvider>
			</CardContent>
		</Card>
	);
}
