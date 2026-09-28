import type { ReactTable } from "@tanstack/react-table";

import type { ColumnConfig } from "./columns.ts";
import type { TableFeatures as $TableFeatures } from "./features/index.ts";
import type { View } from "./views.ts";

export type TableFeatures = typeof $TableFeatures;

/** Board drag-and-drop move descriptor. */
export interface BoardMoveArgs {
	columnId: string;
	fromGroup: string;
	itemId: string;
	toGroup: string;
}

/** Handler for board card moves (`Provider` `onMove` prop). */
export type BoardMoveHandler = (args: BoardMoveArgs) => void;

/** View slice of the explorer context (persisted views). */
export interface DataExplorerViewState {
	activeView?: View | null;
	activeViewId: string | null;
	applyView: (viewId: string | null) => void;
	createView: (
		name: string,
		data?: { display?: View["display"]; refine?: View["refine"] },
	) => Promise<View>;
	deleteView: (viewId: string) => Promise<boolean>;
	error: unknown;
	isLoading: boolean;
	renameView: (viewId: string, name: string) => Promise<View>;
	/** Resets to `defaultDisplay` + empty filters when nothing is saved. */
	resetToSaved: () => void;
	/** Persists the active view. Returns `false` when no view is active; throws `VIEWS_NOT_CONFIGURED` without an adapter. */
	saveView: () => Promise<boolean>;
	views?: View[];
}

/**
 * Canonical context value. Parameterized by row type so `table`,
 * `row.original`, and `data.items` stay typed end to end.
 */
export interface DataExplorerContextValue<
	TItem extends Record<string, unknown> = Record<string, unknown>,
> {
	columnsConfig: ColumnConfig[];
	data: {
		hasMore: boolean;
		isLoading: boolean;
		isLoadingMore: boolean;
		items: TItem[];
		loadMoreRef: (el: Element | null) => void;
	};
	onMove?: BoardMoveHandler;
	table: ReactTable<TableFeatures, TItem>;
	view: DataExplorerViewState;
}
