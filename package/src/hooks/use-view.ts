import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactTable } from "@tanstack/react-table";
import { useCallback, useMemo, useState } from "react";

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

/**
 * Persisted filter + display views.
 *
 * - `saveView()` persists the active view only; `createView(name, data?)`
 *   creates one (omitted `display`/`refine` snapshot from the table).
 * - `applyView(null)` / `resetToSaved()` with no active view resets to
 *   `defaultDisplay` + empty filters. Unknown ids after load reset too;
 *   while views are loading, `applyView` preserves unpersisted work.
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

	const resetToDefault = useCallback(() => {
		table.setDataFilters([]);
		applyDisplaySnapshot(defaultDisplay, table, columnsConfig);
	}, [table, defaultDisplay, columnsConfig]);

	const applySnapshot = useCallback(
		(refine: FilterCondition[], display: FilterViewDisplay) => {
			// React batches sequential setters; `applyDisplaySnapshot` owns
			// the display transaction (single transition over 6 setters).
			table.setDataFilters(refine);
			applyDisplaySnapshot(
				mergeDisplay(defaultDisplay, display),
				table,
				columnsConfig,
			);
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
			if (viewAdapter && views === undefined) return;
			const view = views?.find((v) => v.id === viewId);
			if (!view) {
				if (!viewsLoading) resetToDefault();
				return;
			}
			applySnapshot(view.refine, view.display);
		},
		[views, viewsLoading, viewAdapter, resetToDefault, applySnapshot],
	);

	const saveView = useCallback(async (): Promise<boolean> => {
		if (!(activeViewId && viewAdapter)) return false;
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
		): Promise<View | null> => {
			if (!viewAdapter?.createView) return null;
			const created = await viewAdapter.createView(domain, {
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
			if (!viewAdapter?.deleteView) return false;
			await viewAdapter.deleteView(viewId);
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
		async (viewId: string, name: string): Promise<View | null> => {
			if (!viewAdapter?.renameView) return null;
			const renamed = await viewAdapter.renameView(viewId, name);
			await queryClient.invalidateQueries({
				queryKey: viewQueryKey(domain),
			});
			return renamed;
		},
		[domain, queryClient, viewAdapter],
	);

	const resetToSaved = useCallback((): void => {
		if (!activeView) {
			if (viewAdapter && views === undefined) return;
			resetToDefault();
			return;
		}
		applySnapshot(activeView.refine, activeView.display);
	}, [activeView, views, viewAdapter, resetToDefault, applySnapshot]);

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
