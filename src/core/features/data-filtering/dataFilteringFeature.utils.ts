import type { Updater } from "@tanstack/react-table";

import type { FilterCondition } from "../../types.ts";
import type { DataFiltersState } from "./dataFilteringFeature.types.ts";

/* biome-ignore lint/suspicious/noExplicitAny: feature utils match TanStack's internal table shape */
type AnyTable = any;

export function getDefaultDataFiltersState(): DataFiltersState {
  return [];
}

export function table_setDataFilters(
  table: AnyTable,
  updater: Updater<DataFiltersState>,
): void {
  table.options.onDataFiltersChange?.(updater);
}

export function table_addDataFilter(
  table: AnyTable,
  condition: FilterCondition,
): void {
  table.options.onDataFiltersChange?.((prev: DataFiltersState) => [
    ...prev,
    condition,
  ]);
}

export function table_removeDataFilter(table: AnyTable, id: string): void {
  table.options.onDataFiltersChange?.((prev: DataFiltersState) =>
    prev.filter((item) => item.id !== id),
  );
}

export function table_updateDataFilter(
  table: AnyTable,
  id: string,
  updates: Partial<FilterCondition>,
): void {
  table.options.onDataFiltersChange?.((prev: DataFiltersState) =>
    prev.map((item) => (item.id === id ? { ...item, ...updates } : item)),
  );
}

export function table_clearDataFilters(table: AnyTable): void {
  table.options.onDataFiltersChange?.([]);
}

export function table_resetDataFilters(
  table: AnyTable,
  defaultState?: boolean,
): void {
  table.options.onDataFiltersChange?.(
    defaultState
      ? getDefaultDataFiltersState()
      : (table.initialState.dataFilters ?? getDefaultDataFiltersState()),
  );
}
