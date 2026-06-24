import {
  columnGroupingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  rowSelectionFeature,
  rowSortingFeature,
  tableFeatures,
} from "@tanstack/react-table";

import type { DataExplorerColumnMeta } from "./types.ts";

/**
 * The set of TanStack Table features the data-explorer headless core is built
 * on. Created once at module scope (per the `tableFeatures` recommendation)
 * so every table instance the {@link Provider} creates shares the same feature
 * contract and the same `ColumnDef` type parameter.
 *
 * The features own the *interaction* state (row selection, column visibility,
 * sorting, column sizing, grouping). Of these, everything except row selection
 * is mirrored into {@link FilterViewDisplay} so it persists into saved views
 * and feeds the data query key; row selection stays table-internal because it
 * is transient. Sorting and grouping are `manual` so the row model is never
 * reordered client-side — the server supplies pre-sorted, flat rows.
 */
export const dataExplorerTableFeatures = tableFeatures({
  columnGroupingFeature,
  columnMeta: {} as DataExplorerColumnMeta,
  columnSizingFeature,
  columnVisibilityFeature,
  rowSelectionFeature,
  rowSortingFeature,
});

export type DataExplorerTableFeatures = typeof dataExplorerTableFeatures;
