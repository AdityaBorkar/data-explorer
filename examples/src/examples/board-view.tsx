import { BoardView, FilterBar } from "@adityab/data-explorer/ui";
import { useState } from "react";

import { ExplorerShell } from "#/components/explorer-shell";
import { TASKS, type Task } from "#/lib/tasks";

const PRIORITY_STYLES: Record<Task["priority"], string> = {
	high: "bg-destructive/10 text-destructive",
	low: "bg-muted text-muted-foreground",
	med: "bg-primary/10 text-primary",
};

function TaskCard({ item }: { item: Task }) {
	return (
		<div className="rounded-md border bg-card p-3 text-sm shadow-xs">
			<p className="font-medium">{item.title}</p>
			<div className="mt-2 flex items-center gap-1.5 text-xs">
				<span
					className={`rounded px-1.5 py-0.5 font-medium ${PRIORITY_STYLES[item.priority]}`}
				>
					{item.priority}
				</span>
				<span className="text-muted-foreground">
					est. {item.estimate} · due {item.due}
				</span>
			</div>
		</div>
	);
}

/**
 * 5 · Board view — groups rows by the `status` enum column; dragging a
 * card across columns fires `onMove`, which persists the new status
 * back into the row list.
 */
export function BoardViewExample() {
	const [tasks, setTasks] = useState<Task[]>(TASKS);

	return (
		<ExplorerShell
			defaultDisplay={{
				columnWidths: {},
				density: "comfortable",
				fields: [
					"title",
					"status",
					"priority",
					"estimate",
					"due",
					"tags",
					"done",
				],
				groupBy: "status",
				orderBy: "title",
				orderType: "asc",
				type: "board",
			}}
			description="Grouped by status — drag cards between columns to move them."
			domain="board-view"
			onMove={({ itemId, toGroup }) => {
				setTasks((prev) =>
					prev.map((t) =>
						t.id === itemId
							? {
									...t,
									done: toGroup === "done",
									status: toGroup as Task["status"],
								}
							: t,
					),
				);
			}}
			source={tasks}
			title="5 · Board view"
		>
			<div className="grid gap-3">
				<FilterBar />
				<div className="h-[480px] overflow-hidden rounded-lg border">
					<BoardView
						getRowId={(item: Task) => item.id}
						renderCard={(item: Task) => <TaskCard item={item} />}
					/>
				</div>
			</div>
		</ExplorerShell>
	);
}
