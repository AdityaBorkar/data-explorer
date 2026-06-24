import type { Updater } from "@tanstack/react-table";

import type { Density, ViewType } from "../../types.ts";

/* biome-ignore lint/suspicious/noExplicitAny: feature utils match TanStack's internal table shape */
type AnyTable = any;

const DEFAULT_DENSITY: Density = "comfortable";
const DEFAULT_VIEW_TYPE: ViewType = "table";

export function getDefaultDisplayMetaState(): {
  density: Density;
  viewType: ViewType;
} {
  return { density: DEFAULT_DENSITY, viewType: DEFAULT_VIEW_TYPE };
}

export function table_setDensity(
  table: AnyTable,
  updater: Updater<Density>,
): void {
  table.options.onDensityChange?.(updater);
}

export function table_setViewType(
  table: AnyTable,
  updater: Updater<ViewType>,
): void {
  table.options.onViewTypeChange?.(updater);
}

export function table_resetDensity(
  table: AnyTable,
  defaultState?: boolean,
): void {
  table.options.onDensityChange?.(
    defaultState
      ? DEFAULT_DENSITY
      : (table.initialState.density ?? DEFAULT_DENSITY),
  );
}

export function table_resetViewType(
  table: AnyTable,
  defaultState?: boolean,
): void {
  table.options.onViewTypeChange?.(
    defaultState
      ? DEFAULT_VIEW_TYPE
      : (table.initialState.viewType ?? DEFAULT_VIEW_TYPE),
  );
}
