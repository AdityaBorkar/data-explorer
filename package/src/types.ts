// Domain barrels: the canonical home for each concept. `types.ts` stays as
// the composition root (context shape) and re-exports these for compat.
export * from "./columns.ts";
export * from "./errors.ts";
export * from "./filters.ts";
export * from "./query.ts";
export * from "./views.ts";

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
	) => Promise<View | null>;
	deleteView: (viewId: string) => Promise<boolean>;
	error: unknown;
	isLoading: boolean;
	renameView: (viewId: string, name: string) => Promise<View | null>;
	/** Resets to `defaultDisplay` + empty filters when nothing is saved. */
	resetToSaved: () => void;
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

/**
 * @deprecated Use {@link DataExplorerContextValue}. Kept as an alias for one minor.
 */
export type DataExplorerContextType<
	TItem extends Record<string, unknown> = Record<string, unknown>,
> = DataExplorerContextValue<TItem>;
