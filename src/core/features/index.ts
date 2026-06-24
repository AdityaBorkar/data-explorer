import {
  columnGroupingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  rowSelectionFeature,
  rowSortingFeature,
  tableFeatures,
} from "@tanstack/react-table";

import type { DataExplorerColumnMeta } from "../types.ts";
import { dataFilteringFeature } from "./data-filtering/dataFilteringFeature.ts";

export const dataExplorerTableFeatures = tableFeatures({
  columnGroupingFeature,
  columnMeta: {} as DataExplorerColumnMeta,
  columnSizingFeature,
  columnVisibilityFeature,
  dataFilteringFeature,
  rowSelectionFeature,
  rowSortingFeature,
});

export type DataExplorerTableFeatures = typeof dataExplorerTableFeatures;
