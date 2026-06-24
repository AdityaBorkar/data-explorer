import type { ReactTable } from "@tanstack/react-table";

import type { DataExplorerTableFeatures } from "./features";

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
  density: "compact" | "comfortable" | "spacious";
  fields: string[];
  groupBy: string | null;
  orderBy: string;
  orderType: "asc" | "desc";
  type: "table" | "board" | "timeline";
}

export interface ConfigContextType {
  columnsConfig: ColumnConfig[];
}

export interface FilterContextType {
  addFilter: (v: FilterCondition) => void;
  clearFilters: () => void;
  filterConditions: FilterCondition[];
  removeFilter: (id: string) => void;
  setFilters: (v: FilterCondition[]) => void;
  updateFilter: (id: string, updates: Partial<FilterCondition>) => void;
}

export interface DisplayContextType {
  display: FilterViewDisplay;
  updateDisplay: (updates: Partial<FilterViewDisplay>) => void;
}

export interface SelectionContextType {
  allRowIds: string[];
  clearSelection: () => void;
  selectAll: () => void;
  selectedRowIds: Set<string>;
  toggleRowSelection: (id: string) => void;
}

export interface DataContextType<TItem = unknown> {
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  items: TItem[];
  loadMoreRef: (el: Element | null) => void;
}

export interface ViewContextType {
  activeViewId: string | null;
  applyView: (viewId: string | null) => void;
  resetToSaved: () => void;
  saveView: () => void;
}

export interface CallbackContextType {
  onMove?: (args: {
    itemId: string;
    fromGroup: string;
    toGroup: string;
    columnId: string;
  }) => void;
}

export interface TableContextType {
  table: ReactTable<DataExplorerTableFeatures, Record<string, unknown>>;
}

export interface ContextType<TItem = unknown>
  extends ConfigContextType,
    FilterContextType,
    DisplayContextType,
    SelectionContextType,
    DataContextType<TItem>,
    ViewContextType,
    CallbackContextType {}

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
  filters: FilterCondition[];
  cursor?: string;
  limit: number;
  orderBy: { columnId: string; direction: "asc" | "desc" };
  display: FilterViewDisplay;
};
