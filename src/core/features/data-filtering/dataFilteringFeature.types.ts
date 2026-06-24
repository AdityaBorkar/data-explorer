import type {
  OnChangeFn,
  RowData,
  TableFeatures,
  Updater,
} from "@tanstack/react-table";

import type { FilterCondition } from "../../types.ts";

export type DataFiltersState = FilterCondition[];

export interface TableState_DataFiltering {
  dataFilters: DataFiltersState;
}

export interface TableOptions_DataFiltering {
  onDataFiltersChange?: OnChangeFn<DataFiltersState>;
}

export interface Table_DataFiltering {
  addDataFilter: (condition: FilterCondition) => void;
  clearDataFilters: () => void;
  removeDataFilter: (id: string) => void;
  resetDataFilters: (defaultState?: boolean) => void;
  setDataFilters: (updater: Updater<DataFiltersState>) => void;
  updateDataFilter: (id: string, updates: Partial<FilterCondition>) => void;
}

declare module "@tanstack/react-table" {
  interface TableState_All {
    dataFilters?: DataFiltersState;
  }

  interface TableState_FeatureMap {
    dataFilteringFeature: TableState_DataFiltering;
  }

  interface TableOptions_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    dataFilteringFeature: TableOptions_DataFiltering;
  }

  interface Table_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    dataFilteringFeature: Table_DataFiltering;
  }
}
