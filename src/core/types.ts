import type {
  ColumnSizingState,
  ColumnVisibilityState,
  GroupingState,
  ReactTable,
  SortingState,
} from "@tanstack/react-table";

import type { DataExplorerTableFeatures } from "./features";

export type ViewType = "table" | "board" | "timeline";
export type Density = "compact" | "comfortable" | "spacious";

export interface View {
  display: FilterViewDisplay;
  id: string;
  name: string;
  refine: FilterCondition[];
}

export interface ViewAdapter {
  listViews: (domain: string) => Promise<View[]>;
  updateView: (
    id: string,
    data: { display: FilterViewDisplay; refine: FilterCondition[] },
  ) => Promise<void>;
}

export type ColumnDataType =
  | "string"
  | "number"
  | "date"
  | "boolean"
  | "enum"
  | "multiEnum";

export type FilterOperator =
  | "eq"
  | "neq"
  | "contains"
  | "notContains"
  | "startsWith"
  | "endsWith"
  | "isEmpty"
  | "isNotEmpty"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "between"
  | "notBetween"
  | "in"
  | "notIn"
  | "include"
  | "exclude"
  | "includeAny"
  | "includeAll"
  | "excludeAny"
  | "excludeAll";

export const SEARCH_COLUMN_ID = "_search" as const;

export function isSearchColumn(col: { id: string }): boolean {
  return col.id === SEARCH_COLUMN_ID;
}

export interface DataExplorerColumnMeta<TIcon = unknown> {
  displayName: string;
  endOf?: "timeline";
  icon?: TIcon;
  max?: number;
  min?: number;
  operators?: FilterOperator[];
  options?: { label: string; value: string }[];
  searchable?: boolean;
  startOf?: "timeline";
  type: ColumnDataType;
}

export interface ColumnConfig<TIcon = unknown>
  extends DataExplorerColumnMeta<TIcon> {
  id: string;
}

export interface FilterCondition {
  columnId: string;
  combinator: "and" | "or";
  id: string;
  operator: FilterOperator;
  value: unknown;
}

export interface FilterGroup {
  combinator: "and" | "or";
  conditions: (FilterCondition | FilterGroup)[];
  id: string;
}

export interface FilterViewDisplay {
  columnWidths: Record<string, number>;
  density: Density;
  fields: string[];
  groupBy: string | null;
  orderBy: string;
  orderType: "asc" | "desc";
  type: ViewType;
}

export interface DataExplorerContextType<TItem = unknown> {
  columnsConfig: ColumnConfig[];
  data: {
    hasMore: boolean;
    isLoading: boolean;
    isLoadingMore: boolean;
    items: TItem[];
    loadMoreRef: (el: Element | null) => void;
  };
  density: Density;
  onMove?: (args: {
    itemId: string;
    fromGroup: string;
    toGroup: string;
    columnId: string;
  }) => void;
  setDensity: (density: Density) => void;
  setViewType: (viewType: ViewType) => void;
  view: {
    activeViewId: string | null;
    applyView: (viewId: string | null) => void;
    resetToSaved: () => void;
    saveView: () => void;
  };
  viewType: ViewType;
}

export interface ContextType<TItem = unknown>
  extends DataExplorerContextType<TItem> {
  table: ReactTable<DataExplorerTableFeatures, Record<string, unknown>>;
}

export interface ListQueryResult<TItem> {
  items: TItem[];
  nextCursor?: string | null;
}

export interface SerializedFilterCondition {
  b: "and" | "or";
  c: string;
  o: string;
  v: unknown;
}

export type RefineOptions = {
  columnSizing: ColumnSizingState;
  columnVisibility: ColumnVisibilityState;
  cursor?: string;
  density: Density;
  filters: FilterCondition[];
  grouping: GroupingState;
  limit: number;
  orderBy: { columnId: string; direction: "asc" | "desc" };
  sorting: SortingState;
  viewType: ViewType;
};
