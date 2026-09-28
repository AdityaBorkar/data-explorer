import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactTable } from "@tanstack/react-table";
import { startTransition, useCallback, useMemo, useState } from "react";

import { DataExplorerError } from "../errors.ts";
import {
	applyDisplaySnapshot,
	mergeDisplay,
	toDisplaySnapshot,
} from "../features/display-snapshot.ts";
import type {
	ColumnConfig,
	FilterCondition,
	FilterViewDisplay,
	TableFeatures,
	View,
	ViewAdapter,
} from "../types.ts";

/** Cache-key factory for persisted views (use for prefetch/invalidation). */
export function viewQueryKey(domain: string): readonly unknown[] {
	return ["data-explorer", domain, "views"] as const;
}

function requireViewAdapter(
	viewAdapter: ViewAdapter | undefined,
	operation: string,
): asserts viewAdapter is ViewAdapter {
	if (!viewAdapter) {
		throw new DataExplorerError(
			"VIEWS_NOT_CONFIGURED",
			`Cannot ${operation}: no viewAdapter was provided to <Provider>.`,
			{ operation },
		);
	}
}

/** Require an optional adapter method, narrowing it in one place instead of repeating the same guard per operation. */
function requireAdapterMethod<
	K extends "createView" | "deleteView" | "renameView",
>(
	viewAdapter: ViewAdapter,
	method: K,
	operation: string,
): NonNullable<ViewAdapter[K]> {
	const fn = viewAdapter[method];
	if (!fn) {
		throw new DataExplorerError(
			"VIEWS_NOT_CONFIGURED",
			`Cannot ${operation}: viewAdapter.${method} is not implemented.`,
			{ operation: method },
		);
	}
	return fn as NonNullable<ViewAdapter[K]>;
}

/** Single derived view-list status: one switch instead of three overlapping flags. */
type ViewsStatus = "disabled" | "loading" | "ready";

/**
 * Persisted filter + display views.
 *
 * - `saveView()` persists the active view only (returns `false` when no
 *   view is active; throws `VIEWS_NOT_CONFIGURED` without an adapter).
 *   `createView(name, data?)` creates one (omitted `display`/`refine`
 *   snapshot from the table).
 * - `applyView(null)` / `resetToSaved()` with no active view resets to
 *   `defaultDisplay` + empty filters. Unknown ids after load reset too;
 *   while views are loading, `applyView` preserves unpersisted work.
 * - `createView` / `deleteView` / `renameView` require the matching
 *   optional adapter method and throw `VIEWS_NOT_CONFIGURED` otherwise.
 * - Read `isLoading` / `views` to toast on unknown ids — no outcome codes.
 *
 * @example
 * ```tsx
 * const { views, applyView, createView } = useView({ columnsConfig, defaultDisplay, domain, table, viewAdapter });
 * applyView("backlog");
 * ```
 */
export function useView<TItem extends Record<string, unknown>>({
	columnsConfig,
	defaultDisplay,
	domain,
	table,
	viewAdapter,
}: {
	columnsConfig: ColumnConfig[];
	defaultDisplay: FilterViewDisplay;
	domain: string;
	table: ReactTable<TableFeatures, TItem>;
	viewAdapter?: ViewAdapter;
}) {
	const queryClient = useQueryClient();
	const [activeViewId, setActiveViewId] = useState<string | null>(null);

	const {
		data: views,
		error,
		isLoading: viewsLoading,
	} = useQuery({
		enabled: !!viewAdapter,
		queryFn: () => viewAdapter?.listViews(domain) ?? [],
		queryKey: viewQueryKey(domain),
	});

	const activeView = useMemo(
		() => views?.find((v) => v.id === activeViewId) ?? null,
		[views, activeViewId],
	);

	// Single status for the view list: callers preserve unpersisted work
	// while loading instead of resetting.
	const viewsStatus: ViewsStatus =
		viewAdapter === undefined
			? "disabled"
			: views === undefined
				? "loading"
				: "ready";

	const resetToDefault = useCallback(() => {
		table.setDataFilters([]);
		applyDisplaySnapshot(defaultDisplay, table, columnsConfig);
	}, [table, defaultDisplay, columnsConfig]);

	const applySnapshot = useCallback(
		(refine: FilterCondition[], display: FilterViewDisplay) => {
			// One transaction for filters + the 6 display setters so
			// subscribers never observe a half-applied view.
			startTransition(() => {
				table.setDataFilters(refine);
				applyDisplaySnapshot(
					mergeDisplay(defaultDisplay, display),
					table,
					columnsConfig,
				);
			});
		},
		[table, defaultDisplay, columnsConfig],
	);

	const applyView = useCallback(
		(viewId: string | null): void => {
			setActiveViewId(viewId);
			if (!viewId) {
				resetToDefault();
				return;
			}
			// Never wipe unpersisted work while views are still loading.
			if (viewsStatus === "loading") return;
			const view = views?.find((v) => v.id === viewId);
			if (!view) {
				if (viewsStatus === "ready") resetToDefault();
				return;
			}
			applySnapshot(view.refine, view.display);
		},
		[views, viewsStatus, resetToDefault, applySnapshot],
	);

	const saveView = useCallback(async (): Promise<boolean> => {
		requireViewAdapter(viewAdapter, "save the active view");
		if (!activeViewId) return false;
		const display = toDisplaySnapshot(table, columnsConfig);
		await viewAdapter.updateView(activeViewId, {
			display,
			refine: table.state.dataFilters,
		});
		await queryClient.invalidateQueries({
			queryKey: viewQueryKey(domain),
		});
		return true;
	}, [activeViewId, columnsConfig, domain, queryClient, table, viewAdapter]);

	const createView = useCallback(
		async (
			name: string,
			data?: { display?: View["display"]; refine?: View["refine"] },
		): Promise<View> => {
			requireViewAdapter(viewAdapter, "create a view");
			const create = requireAdapterMethod(
				viewAdapter,
				"createView",
				"create a view",
			);
			const created = await create(domain, {
				display: data?.display ?? toDisplaySnapshot(table, columnsConfig),
				name,
				refine: data?.refine ?? table.state.dataFilters,
			});
			setActiveViewId(created.id);
			await queryClient.invalidateQueries({
				queryKey: viewQueryKey(domain),
			});
			return created;
		},
		[columnsConfig, domain, queryClient, table, viewAdapter],
	);

	const deleteView = useCallback(
		async (viewId: string): Promise<boolean> => {
			requireViewAdapter(viewAdapter, "delete a view");
			const remove = requireAdapterMethod(
				viewAdapter,
				"deleteView",
				"delete a view",
			);
			await remove(viewId);
			if (activeViewId === viewId) {
				setActiveViewId(null);
				resetToDefault();
			}
			await queryClient.invalidateQueries({
				queryKey: viewQueryKey(domain),
			});
			return true;
		},
		[activeViewId, domain, queryClient, resetToDefault, viewAdapter],
	);

	const renameView = useCallback(
		async (viewId: string, name: string): Promise<View> => {
			requireViewAdapter(viewAdapter, "rename a view");
			const rename = requireAdapterMethod(
				viewAdapter,
				"renameView",
				"rename a view",
			);
			const renamed = await rename(viewId, name);
			await queryClient.invalidateQueries({
				queryKey: viewQueryKey(domain),
			});
			return renamed;
		},
		[domain, queryClient, viewAdapter],
	);

	const resetToSaved = useCallback((): void => {
		if (!activeView) {
			if (viewsStatus === "loading") return;
			resetToDefault();
			return;
		}
		applySnapshot(activeView.refine, activeView.display);
	}, [activeView, viewsStatus, resetToDefault, applySnapshot]);

	return useMemo(
		() => ({
			activeView,
			activeViewId,
			applyView,
			createView,
			deleteView,
			error,
			isLoading: viewsLoading,
			renameView,
			resetToSaved,
			saveView,
			views,
		}),
		[
			activeView,
			activeViewId,
			applyView,
			createView,
			deleteView,
			error,
			viewsLoading,
			renameView,
			resetToSaved,
			saveView,
			views,
		],
	);
}
