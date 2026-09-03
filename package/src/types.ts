// Domain barrels: the canonical home for each concept. `types.ts` stays as
// the composition root (context shape) and re-exports these for compat.
export * from "./columns.ts";
export * from "./filters.ts";
export * from "./query.ts";
export * from "./views.ts";

import type { ReactTable } from "@tanstack/react-table";

import type { ColumnConfig } from "./columns.ts";
import type { TableFeatures as $TableFeatures } from "./features/index.ts";
import type { View } from "./views.ts";

export type TableFeatures = typeof $TableFeatures;

export interface DataExplorerContextType<TItem = unknown> {
	columnsConfig: ColumnConfig[];
	data: {
		hasMore: boolean;
		isLoading: boolean;
		isLoadingMore: boolean;
		items: TItem[];
		loadMoreRef: (el: Element | null) => void;
	};
	onMove?: (args: {
		itemId: string;
		fromGroup: string;
		toGroup: string;
		columnId: string;
	}) => void;
	view: {
		activeView?: View | null;
		activeViewId: string | null;
		applyView: (viewId: string | null) => void;
		resetToSaved: () => void;
		saveView: () => Promise<boolean>;
		views?: View[];
	};
}

export interface ContextType<TItem = unknown>
	extends DataExplorerContextType<TItem> {
	table: ReactTable<TableFeatures, Record<string, unknown>>;
}
