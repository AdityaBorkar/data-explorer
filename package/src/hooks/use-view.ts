import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactTable } from "@tanstack/react-table";
import { startTransition, useCallback, useMemo, useState } from "react";

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
	ViewApplyResult,
} from "../types.ts";

/** Cache-key factory for persisted views (use for prefetch/invalidation). */
export function viewQueryKey(domain: string): readonly unknown[] {
	return ["data-explorer", "views", domain] as const;
}

/**
 * Persisted filter + display views.
 *
 * - `saveView()` persists the active view only; `saveViewAs(name)` /
 *   `createView` need `adapter.createView`.
 * - `applyView` / `resetToSaved` return outcome codes (`unknown-id`,
 *   `deferred-loading`) instead of failing silently — surface them as toasts.
 * - With no active view, `resetToSaved()` resets to `defaultDisplay` +
 *   empty filters.
 *
 * @example
 * ```tsx
 * const { views, applyView, saveViewAs } = useView({ columnsConfig, defaultDisplay, domain, table, viewAdapter });
 * const status = applyView("backlog");
 * if (status === "unknown-id") toast("View no longer exists");
 * ```
 */
export function useView({
	columnsConfig,
	defaultDisplay,
	domain,
	table,
	viewAdapter,
}: {
	columnsConfig: ColumnConfig[];
	defaultDisplay: FilterViewDisplay;
	domain: string;
	table: ReactTable<TableFeatures, Record<string, unknown>>;
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
		startTransition(() => {
			table.setDataFilters([]);
			applyDisplaySnapshot(defaultDisplay, table, columnsConfig);
		});
	}, [table, defaultDisplay, columnsConfig]);

	const applySnapshot = useCallback(
		(refine: FilterCondition[], display: FilterViewDisplay) => {
			// One logical transaction: filters + all display slices together so
			// subscribers never observe a torn intermediate state.
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
		(viewId: string | null): ViewApplyResult => {
			setActiveViewId(viewId);
			if (!viewId) {
				resetToDefault();
				return "reset-to-default";
			}
			// Never wipe unpersisted work while views are still loading.
			if (viewAdapter && views === undefined) return "deferred-loading";
			const view = views?.find((v) => v.id === viewId);
			if (!view) {
				// Unknown id after load: reset; during load we already returned.
				if (!viewsLoading) resetToDefault();
				return viewsLoading ? "deferred-loading" : "unknown-id";
			}
			applySnapshot(view.refine, view.display);
			return "applied";
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

	const saveViewAs = useCallback(
		async (name: string): Promise<View | null> => {
			if (!viewAdapter?.createView) return null;
			const display = toDisplaySnapshot(table, columnsConfig);
			const created = await viewAdapter.createView(domain, {
				display,
				name,
				refine: table.state.dataFilters,
			});
			setActiveViewId(created.id);
			await queryClient.invalidateQueries({
				queryKey: viewQueryKey(domain),
			});
			return created;
		},
		[columnsConfig, domain, queryClient, table, viewAdapter],
	);

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

	const resetToSaved = useCallback((): ViewApplyResult => {
		if (!activeView) {
			if (viewAdapter && views === undefined) return "deferred-loading";
			resetToDefault();
			return "reset-to-default";
		}
		applySnapshot(activeView.refine, activeView.display);
		return "applied";
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
			resetToDefault,
			resetToSaved,
			saveView,
			saveViewAs,
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
			resetToDefault,
			resetToSaved,
			saveView,
			saveViewAs,
			views,
		],
	);
}
