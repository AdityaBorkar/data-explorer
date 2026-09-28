import {
	assignTableAPIs,
	makeStateUpdater,
	type TableFeature,
	type Updater,
} from "@tanstack/react-table";

import "./dataFilteringFeature.types.ts";
import type { FilterCondition } from "../../filters.ts";
import type { DataFiltersState } from "./dataFilteringFeature.types.ts";

/* biome-ignore lint/suspicious/noExplicitAny: feature APIs match TanStack's internal table shape */
type AnyTable = any;

export const dataFilteringFeature: TableFeature = {
	constructTableAPIs: (table: AnyTable) => {
		assignTableAPIs("dataFilteringFeature", table, {
			table_addDataFilter: {
				fn: (condition: FilterCondition) =>
					table.options.onDataFiltersChange?.((prev: DataFiltersState) => [
						...prev,
						condition,
					]),
			},
			table_clearDataFilters: {
				fn: () => table.options.onDataFiltersChange?.([]),
			},
			table_removeDataFilter: {
				fn: (id: string) =>
					table.options.onDataFiltersChange?.((prev: DataFiltersState) =>
						prev.filter((item) => item.id !== id),
					),
			},
			table_resetDataFilters: {
				fn: (defaultState?: boolean) =>
					table.options.onDataFiltersChange?.(
						defaultState ? [] : (table.initialState.dataFilters ?? []),
					),
			},
			table_setDataFilters: {
				fn: (updater: Updater<DataFiltersState>) =>
					table.options.onDataFiltersChange?.(updater),
			},
			table_updateDataFilter: {
				fn: (id: string, updates: Partial<FilterCondition>) =>
					table.options.onDataFiltersChange?.((prev: DataFiltersState) =>
						prev.map((item) =>
							item.id === id ? { ...item, ...updates } : item,
						),
					),
			},
		});
	},

	getDefaultTableOptions: (table) => ({
		onDataFiltersChange: makeStateUpdater("dataFilters", table),
	}),
	getInitialState: (initialState) => ({
		...initialState,
		dataFilters: (initialState.dataFilters ?? []) as DataFiltersState,
	}),
};

declare module "@tanstack/react-table" {
	interface Plugins {
		dataFilteringFeature: typeof dataFilteringFeature;
	}
}
