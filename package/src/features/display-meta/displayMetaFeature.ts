import {
	assignTableAPIs,
	makeStateUpdater,
	type TableFeature,
	type Updater,
} from "@tanstack/react-table";

import "./displayMetaFeature.types.ts";
import type { Density, ViewType } from "../../types.ts";

/* biome-ignore lint/suspicious/noExplicitAny: feature APIs match TanStack's internal table shape */
type AnyTable = any;

const DEFAULT_DENSITY: Density = "comfortable";
const DEFAULT_VIEW_TYPE: ViewType = "table";

export const displayMetaFeature: TableFeature = {
	constructTableAPIs: (table: AnyTable) => {
		assignTableAPIs("displayMetaFeature", table, {
			table_resetDensity: {
				fn: (defaultState?: boolean) =>
					table.options.onDensityChange?.(
						defaultState
							? DEFAULT_DENSITY
							: (table.initialState.density ?? DEFAULT_DENSITY),
					),
			},
			table_resetViewType: {
				fn: (defaultState?: boolean) =>
					table.options.onViewTypeChange?.(
						defaultState
							? DEFAULT_VIEW_TYPE
							: (table.initialState.viewType ?? DEFAULT_VIEW_TYPE),
					),
			},
			table_setDensity: {
				fn: (updater: Updater<Density>) =>
					table.options.onDensityChange?.(updater),
			},
			table_setViewType: {
				fn: (updater: Updater<ViewType>) =>
					table.options.onViewTypeChange?.(updater),
			},
		});
	},

	getDefaultTableOptions: (table) => ({
		onDensityChange: makeStateUpdater("density", table),
		onViewTypeChange: makeStateUpdater("viewType", table),
	}),
	getInitialState: (initialState) => ({
		...initialState,
		density: initialState.density ?? DEFAULT_DENSITY,
		viewType: initialState.viewType ?? DEFAULT_VIEW_TYPE,
	}),
};

declare module "@tanstack/react-table" {
	interface Plugins {
		displayMetaFeature: typeof displayMetaFeature;
	}
}
