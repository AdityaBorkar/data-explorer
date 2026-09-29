import {
	useDataExplorerContext,
	type View,
	type ViewAdapter,
} from "@adistack/data-explorer";
import {
	FilterBar,
	FilterSentence,
	VirtualTable,
} from "@adistack/data-explorer-ui";
import { useMemo, useState } from "react";

import { ExplorerShell } from "#/components/explorer-shell";
import { Button } from "#/components/ui/button";
import { TASKS } from "#/lib/tasks";

/**
 * In-memory `ViewAdapter` — enough for the "Save as view" affordance below
 * (create + list; no persistence across reloads).
 */
function useMemoryViewAdapter(): ViewAdapter {
	return useMemo<ViewAdapter>(() => {
		const views: View[] = [];
		return {
			createView: async (_domain, data) => {
				const view: View = {
					...data,
					id: `view-${views.length + 1}`,
					name: data.name,
				};
				views.push(view);
				return view;
			},
			listViews: async () => [...views],
			updateView: async (id, data) => {
				const index = views.findIndex((v) => v.id === id);
				const current = views[index];
				if (current) views[index] = { ...current, ...data };
			},
		};
	}, []);
}

/** "Save as view" — an app-shell concern: the block stays filter-only. */
function SaveAsView() {
	const { view } = useDataExplorerContext();
	const [name, setName] = useState("");

	const save = (): void => {
		const trimmed = name.trim();
		if (!trimmed) return;
		void view.createView(trimmed).then(() => setName(""));
	};

	return (
		<div className="flex items-center gap-2">
			<input
				aria-label="View name"
				className="h-8 w-44 rounded-md border border-border bg-transparent px-2 text-xs outline-none placeholder:text-muted-foreground focus:border-ring"
				onChange={(event) => setName(event.target.value)}
				onKeyDown={(event) => {
					if (event.key === "Enter") save();
				}}
				placeholder="View name"
				value={name}
			/>
			<Button
				disabled={!name.trim()}
				onClick={save}
				size="sm"
				variant="outline"
			>
				Save as view
			</Button>
			<span className="text-muted-foreground text-xs">
				{view.views?.length ?? 0} saved
			</span>
		</div>
	);
}

/**
 * 9 · Filter sentence — committed filters rendered as prose ("Tasks whose
 * status is todo and priority is high") that morphs in place into a
 * Where/And/Or builder. Edit snapshots `table.state.dataFilters` into a
 * draft; Save validates every row and commits atomically, so the FilterBar
 * chips below stay in sync through the same table state.
 */
export function FilterSentenceExample() {
	const viewAdapter = useMemoryViewAdapter();
	return (
		<ExplorerShell
			description="Sentence ↔ builder morph with draft-then-commit editing."
			domain="filter-sentence"
			source={TASKS}
			title="9 · Filter sentence"
			viewAdapter={viewAdapter}
		>
			<div className="grid gap-3">
				<FilterSentence subject="Tasks" />
				<div className="flex flex-wrap items-center justify-between gap-2">
					<FilterBar />
					<SaveAsView />
				</div>
				<div className="h-[440px]">
					<VirtualTable />
				</div>
			</div>
		</ExplorerShell>
	);
}
