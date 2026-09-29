import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactTable } from "@tanstack/react-table";
import { useCallback, useMemo, useState } from "react";

import type { ColumnConfig } from "../columns.ts";
import { DataExplorerError } from "../errors.ts";
import {
	applyTableSnapshot,
	mergeDisplay,
	toDisplaySnapshot,
} from "../features/display-snapshot.ts";
import type { FilterCondition } from "../filters.ts";
import type { TableFeatures } from "../types.ts";
import type { FilterViewDisplay, View, ViewAdapter } from "../views.ts";

/** Cache-key factory for persisted views (use for prefetch/invalidation). */
export function viewQueryKey(domain: string): readonly unknown[] {
	return ["data-explorer", domain, "views"] as const;
}

/**
 * Single guard for the adapter and its optional methods: asserts the
 * adapter exists and narrows the requested method in one place instead of
 * repeating the same `VIEWS_NOT_CONFIGURED` branches per operation.
 */
function getAdapterMethod<K extends "createView" | "deleteView" | "renameView">(
	viewAdapter: ViewAdapter | undefined,
	method: K,
	operation: string,
): NonNullable<ViewAdapter[K]> {
	if (!viewAdapter) {
		throw new DataExplorerError(
			"VIEWS_NOT_CONFIGURED",
			`Cannot ${operation}: no viewAdapter was provided to <Provider>.`,
			{ operation },
		);
	}
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
 *   `defaultDisplay` + empty filters. Unknown ids after load clear the
 *   selection and reset too; while views are loading, `applyView` records
 *   the intent without wiping unpersisted work.
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

	const invalidateViews = useCallback(
		() =>
			queryClient.invalidateQueries({
				queryKey: viewQueryKey(domain),
			}),
		[domain, queryClient],
	);

	const resetToDefault = useCallback(() => {
		applyTableSnapshot(table, columnsConfig, {
			display: defaultDisplay,
			refine: [],
		});
	}, [table, defaultDisplay, columnsConfig]);

	const applySnapshot = useCallback(
		(refine: FilterCondition[], display: FilterViewDisplay) => {
			applyTableSnapshot(table, columnsConfig, {
				display: mergeDisplay(defaultDisplay, display),
				refine,
			});
		},
		[table, defaultDisplay, columnsConfig],
	);

	const applyView = useCallback(
		(viewId: string | null): void => {
			if (!viewId) {
				setActiveViewId(null);
				resetToDefault();
				return;
			}
			// Never wipe unpersisted work while views are still loading —
			// record the intent and wait for the list.
			if (viewsStatus === "loading") {
				setActiveViewId(viewId);
				return;
			}
			const view = views?.find((v) => v.id === viewId);
			if (!view) {
				// Unknown id (or no adapter): clear the stale selection so
				// `activeViewId` never points at a view that doesn't exist.
				setActiveViewId(null);
				resetToDefault();
				return;
			}
			setActiveViewId(viewId);
			applySnapshot(view.refine, view.display);
		},
		[views, viewsStatus, resetToDefault, applySnapshot],
	);

	const saveView = useCallback(async (): Promise<boolean> => {
		if (!viewAdapter) {
			throw new DataExplorerError(
				"VIEWS_NOT_CONFIGURED",
				"Cannot save the active view: no viewAdapter was provided to <Provider>.",
				{ operation: "save the active view" },
			);
		}
		if (!activeViewId) return false;
		const display = toDisplaySnapshot(table, columnsConfig);
		await viewAdapter.updateView(activeViewId, {
			display,
			refine: table.state.dataFilters,
		});
		await invalidateViews();
		return true;
	}, [activeViewId, columnsConfig, invalidateViews, table, viewAdapter]);

	const createView = useCallback(
		async (
			name: string,
			data?: { display?: View["display"]; refine?: View["refine"] },
		): Promise<View> => {
			const create = getAdapterMethod(
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
			await invalidateViews();
			return created;
		},
		[columnsConfig, domain, invalidateViews, table, viewAdapter],
	);

	const deleteView = useCallback(
		async (viewId: string): Promise<boolean> => {
			const remove = getAdapterMethod(
				viewAdapter,
				"deleteView",
				"delete a view",
			);
			await remove(viewId);
			if (activeViewId === viewId) {
				setActiveViewId(null);
				resetToDefault();
			}
			await invalidateViews();
			return true;
		},
		[activeViewId, invalidateViews, resetToDefault, viewAdapter],
	);

	const renameView = useCallback(
		async (viewId: string, name: string): Promise<View> => {
			const rename = getAdapterMethod(
				viewAdapter,
				"renameView",
				"rename a view",
			);
			const renamed = await rename(viewId, name);
			await invalidateViews();
			return renamed;
		},
		[invalidateViews, viewAdapter],
	);

	const resetToSaved = useCallback((): void => {
		if (!activeView) {
			if (viewsStatus === "loading") return;
			setActiveViewId(null);
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
