import type {
	ColumnSizingState,
	ColumnVisibilityState,
	GroupingState,
	SortingState,
} from "@tanstack/react-table";

import type { FilterCondition } from "./filters.ts";
import type { Density, ViewType } from "./views.ts";

export interface ListQueryResult<TItem> {
	items: TItem[];
	nextCursor?: string | null;
}

/** Sort direction shared by `orderBy` and TanStack sorting state. */
export type SortDirection = "asc" | "desc";

/** Single-column order descriptor (display snapshots are single-sort; see `toInitialSorting`). */
export interface SortOrder {
	columnId: string;
	direction: SortDirection;
}

export type DataRefineOptions = {
	cursor?: string;
	filters: FilterCondition[];
	grouping: GroupingState;
	limit: number;
	orderBy: SortOrder;
	sorting: SortingState;
};

export type RefineOptions = DataRefineOptions & {
	columnSizing: ColumnSizingState;
	columnVisibility: ColumnVisibilityState;
	density: Density;
	viewType: ViewType;
};
