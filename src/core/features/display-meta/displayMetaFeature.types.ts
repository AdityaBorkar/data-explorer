import type {
  OnChangeFn,
  RowData,
  TableFeatures,
  Updater,
} from "@tanstack/react-table";

import type { Density, ViewType } from "../../types.ts";

export interface DisplayMetaState {
  density: Density;
  viewType: ViewType;
}

export interface TableState_DisplayMeta {
  density: Density;
  viewType: ViewType;
}

export interface TableOptions_DisplayMeta {
  onDensityChange?: OnChangeFn<Density>;
  onViewTypeChange?: OnChangeFn<ViewType>;
}

export interface Table_DisplayMeta {
  resetDensity: (defaultState?: boolean) => void;
  resetViewType: (defaultState?: boolean) => void;
  setDensity: (updater: Updater<Density>) => void;
  setViewType: (updater: Updater<ViewType>) => void;
}

declare module "@tanstack/react-table" {
  interface TableState_All {
    density?: Density;
    viewType?: ViewType;
  }

  interface TableState_FeatureMap {
    displayMetaFeature: TableState_DisplayMeta;
  }

  interface TableOptions_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    displayMetaFeature: TableOptions_DisplayMeta;
  }

  interface Table_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    displayMetaFeature: Table_DisplayMeta;
  }
}
