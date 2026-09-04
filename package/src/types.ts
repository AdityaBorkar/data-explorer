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
import type { View, ViewApplyResult } from "./views.ts";

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
	/** @returns outcome code so UI can toast on `unknown-id` / `deferred-loading`. */
	applyView: (viewId: string | null) => ViewApplyResult;
	createView: (
		name: string,
		data?: { display?: View["display"]; refine?: View["refine"] },
	) => Promise<View | null>;
	deleteView: (viewId: string) => Promise<boolean>;
	error: unknown;
	isLoading: boolean;
	renameView: (viewId: string, name: string) => Promise<View | null>;
	resetToDefault: () => void;
	/** @returns outcome code; resets to `defaultDisplay` + empty filters when nothing is saved. */
	resetToSaved: () => ViewApplyResult;
	saveView: () => Promise<boolean>;
	saveViewAs: (name: string) => Promise<View | null>;
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

/**
 * @deprecated Use {@link DataExplorerContextValue}. Kept as an alias for one minor.
 */
export type ContextType<
	TItem extends Record<string, unknown> = Record<string, unknown>,
> = DataExplorerContextValue<TItem>;
