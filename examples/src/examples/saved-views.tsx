import {
	type FilterCondition,
	type FilterViewDisplay,
	useDataExplorerContext,
	type View,
	type ViewAdapter,
} from "@adistack/data-explorer";
import { FilterBar, VirtualTable } from "@adistack/data-explorer-ui";
import { useMemo } from "react";

import { ExplorerShell } from "#/components/explorer-shell";
import { Button } from "#/components/ui/button";
import { DEFAULT_DISPLAY, TASKS, type Task } from "#/lib/tasks";

const SEED_VIEWS: View[] = [
	{
		display: { ...DEFAULT_DISPLAY },
		id: "backlog",
		name: "Backlog",
		refine: [
			{
				columnId: "status",
				combinator: "and",
				id: "seed-backlog-status",
				operator: "eq",
				value: "todo",
			} satisfies FilterCondition,
		],
	},
	{
		display: {
			...DEFAULT_DISPLAY,
			fields: ["title", "priority", "estimate", "due", "status"],
			orderBy: "estimate",
			orderType: "desc",
		} satisfies FilterViewDisplay,
		id: "high-priority",
		name: "High priority",
		refine: [
			{
				columnId: "priority",
				combinator: "and",
				id: "seed-high-priority",
				operator: "eq",
				value: "high",
			} satisfies FilterCondition,
		],
	},
];

function storageKey(domain: string): string {
	return `data-explorer:views:${domain}`;
}

function readStored(domain: string): View[] | null {
	try {
		const raw = localStorage.getItem(storageKey(domain));
		if (!raw) return null;
		return JSON.parse(raw) as View[];
	} catch {
		return null;
	}
}

function writeStored(domain: string, views: View[]): void {
	try {
		localStorage.setItem(storageKey(domain), JSON.stringify(views));
	} catch {
		// Storage unavailable (private mode) — seeds still work in memory.
	}
}

/** `ViewAdapter` persisted to localStorage, seeded with two views. */
function useLocalViewAdapter(domain: string): ViewAdapter {
	return useMemo<ViewAdapter>(() => {
		let cache: View[] | null = null;
		const load = (): View[] => {
			if (!cache) cache = readStored(domain) ?? [...SEED_VIEWS];
			return cache;
		};
		return {
			listViews: async () => load(),
			updateView: async (id, data) => {
				cache = load().map((v) =>
					v.id === id
						? { ...v, display: data.display, refine: data.refine }
						: v,
				);
				writeStored(domain, cache);
			},
		};
	}, [domain]);
}

function ViewsToolbar() {
	const { table, view } = useDataExplorerContext<Task>();
	const { views } = view as typeof view & { views?: View[] };
	const count = (table.state.dataFilters ?? []).length;

	return (
		<div className="flex flex-wrap items-center gap-2">
			<div className="flex items-center gap-1">
				{(views ?? []).map((v) => (
					<button
						className={`rounded-md border px-2 py-1 text-xs transition-colors ${
							view.activeViewId === v.id
								? "border-primary bg-primary/10 font-medium text-primary"
								: "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
						}`}
						key={v.id}
						onClick={() => view.applyView(v.id)}
						type="button"
					>
						{v.name}
					</button>
				))}
				<button
					className="rounded-md border border-dashed border-border px-2 py-1 text-muted-foreground text-xs transition-colors hover:bg-muted hover:text-foreground"
					onClick={() => view.applyView(null)}
					type="button"
				>
					Default
				</button>
			</div>
			<div className="ml-auto flex items-center gap-2">
				<span className="text-muted-foreground text-xs">
					{count} filter{count === 1 ? "" : "s"}
					{view.activeViewId ? " · edited" : ""}
				</span>
				<Button
					disabled={!view.activeViewId}
					onClick={() => void view.saveView()}
					size="sm"
					variant="outline"
				>
					Save view
				</Button>
				<Button onClick={() => view.resetToSaved()} size="sm" variant="ghost">
					Reset
				</Button>
			</div>
		</div>
	);
}

/**
 * 7 · Saved views — a `ViewAdapter` (localStorage here) backing `useView`:
 * apply a view, tweak filters/display, then save or reset to the snapshot.
 */
export function SavedViews() {
	const viewAdapter = useLocalViewAdapter("saved-views");
	return (
		<ExplorerShell
			description="Apply, edit, save, and reset named filter + display snapshots."
			domain="saved-views"
			source={TASKS}
			title="7 · Saved views"
			viewAdapter={viewAdapter}
		>
			<div className="grid gap-3">
				<ViewsToolbar />
				<FilterBar />
				<div className="h-[440px]">
					<VirtualTable />
				</div>
			</div>
		</ExplorerShell>
	);
}
