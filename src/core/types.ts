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
  icon?: TIcon;
  type: ColumnDataType;
  operators?: FilterOperator[];
  min?: number;
  max?: number;
  searchable?: boolean;
  options?: { label: string; value: string }[];
  startOf?: "timeline";
  endOf?: "timeline";
}

export interface ColumnConfig<TIcon = unknown>
  extends DataExplorerColumnMeta<TIcon> {
  id: string;
}

export interface FilterCondition {
  id: string;
  columnId: string;
  operator: FilterOperator;
  value: unknown;
  combinator: "and" | "or";
}

export interface FilterGroup {
  id: string;
  combinator: "and" | "or";
  conditions: (FilterCondition | FilterGroup)[];
}

export interface FilterViewDisplay {
  type: "table" | "board" | "timeline";
  groupBy: string | null;
  orderBy: string;
  orderType: "asc" | "desc";
  fields: string[];
  columnWidths: Record<string, number>;
  density: "compact" | "comfortable" | "spacious";
}

export interface ConfigContextType {
  columnsConfig: ColumnConfig[];
}

export interface FilterContextType {
  filterConditions: FilterCondition[];
  addFilter: (v: FilterCondition) => void;
  clearFilters: () => void;
  removeFilter: (id: string) => void;
  setFilters: (v: FilterCondition[]) => void;
  updateFilter: (id: string, updates: Partial<FilterCondition>) => void;
}

export interface DisplayContextType {
  display: FilterViewDisplay;
  updateDisplay: (updates: Partial<FilterViewDisplay>) => void;
}

export interface SelectionContextType {
  selectedRowIds: Set<string>;
  toggleRowSelection: (id: string) => void;
  clearSelection: () => void;
  selectAll: () => void;
  allRowIds: string[];
}

export interface DataContextType<TItem = unknown> {
  items: TItem[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  loadMoreRef: (el: Element | null) => void;
}

export interface ViewContextType {
  activeViewId: string | null;
  applyView: (viewId: string | null) => void;
  saveView: () => void;
  resetToSaved: () => void;
}

export interface CallbackContextType {
  onMove?: (args: {
    itemId: string;
    fromGroup: string;
    toGroup: string;
    columnId: string;
  }) => void;
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
  c: string;
  o: string;
  v: unknown;
  b: "and" | "or";
}

export type RefineOptions = {
  filters: FilterCondition[];
  cursor?: string;
  limit: number;
  orderBy: { columnId: string; direction: "asc" | "desc" };
  display: FilterViewDisplay;
};
