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
import { displayMetaFeature } from "./display-meta/displayMetaFeature.ts";

export const TableFeatures = tableFeatures({
  columnGroupingFeature,
  columnMeta: {} as DataExplorerColumnMeta,
  columnSizingFeature,
  columnVisibilityFeature,
  dataFilteringFeature,
  displayMetaFeature,
  rowSelectionFeature,
  rowSortingFeature,
});
