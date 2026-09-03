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

export type DataRefineOptions = {
	cursor?: string;
	filters: FilterCondition[];
	grouping: GroupingState;
	limit: number;
	orderBy: { columnId: string; direction: "asc" | "desc" };
	sorting: SortingState;
};

export type RefineOptions = DataRefineOptions & {
	columnSizing: ColumnSizingState;
	columnVisibility: ColumnVisibilityState;
	density: Density;
	viewType: ViewType;
};
