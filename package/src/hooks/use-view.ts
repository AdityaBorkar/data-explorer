import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactTable } from "@tanstack/react-table";
import { useCallback, useMemo, useState } from "react";

import { mergeDisplay } from "../features/data-filtering/filter-merge.ts";
import {
	applyDisplaySnapshot,
	toDisplaySnapshot,
} from "../features/display-snapshot.ts";
import type {
	ColumnConfig,
	FilterCondition,
	FilterViewDisplay,
	TableFeatures,
	ViewAdapter,
} from "../types.ts";

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

	const { data: views, isLoading: viewsLoading } = useQuery({
		enabled: !!viewAdapter,
		queryFn: () => viewAdapter?.listViews(domain) ?? [],
		queryKey: ["data-explorer", "views", domain],
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
			// One logical transaction: filters + all display slices together so
			// subscribers never observe a torn intermediate state.
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
		(viewId: string | null) => {
			setActiveViewId(viewId);
			if (!viewId) {
				resetToDefault();
				return;
			}
			// Never wipe unpersisted work while views are still loading.
			if (viewAdapter && views === undefined) return;
			const view = views?.find((v) => v.id === viewId);
			if (!view) {
				// Unknown id after load: reset; during load we already returned.
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
			queryKey: ["data-explorer", "views", domain],
		});
		return true;
	}, [activeViewId, columnsConfig, domain, queryClient, table, viewAdapter]);

	const resetToSaved = useCallback(() => {
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
			resetToSaved,
			saveView,
			views,
		}),
		[activeView, activeViewId, applyView, resetToSaved, saveView, views],
	);
}
