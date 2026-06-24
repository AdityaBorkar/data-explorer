import {
  assignTableAPIs,
  makeStateUpdater,
  type TableFeature,
} from "@tanstack/react-table";

import "./dataFilteringFeature.types.ts";
import {
  getDefaultDataFiltersState,
  table_addDataFilter,
  table_clearDataFilters,
  table_removeDataFilter,
  table_resetDataFilters,
  table_setDataFilters,
  table_updateDataFilter,
} from "./dataFilteringFeature.utils.ts";

export const dataFilteringFeature: TableFeature = {
  constructTableAPIs: (table) => {
    assignTableAPIs("dataFilteringFeature", table, {
      table_addDataFilter: {
        fn: (condition) => table_addDataFilter(table, condition),
      },
      table_clearDataFilters: {
        fn: () => table_clearDataFilters(table),
      },
      table_removeDataFilter: {
        fn: (id) => table_removeDataFilter(table, id),
      },
      table_resetDataFilters: {
        fn: (defaultState) => table_resetDataFilters(table, defaultState),
      },
      table_setDataFilters: {
        fn: (updater) => table_setDataFilters(table, updater),
      },
      table_updateDataFilter: {
        fn: (id, updates) => table_updateDataFilter(table, id, updates),
      },
    });
  },

  getDefaultTableOptions: (table) => ({
    onDataFiltersChange: makeStateUpdater("dataFilters", table),
  }),
  getInitialState: (initialState) => ({
    ...initialState,
    dataFilters: getDefaultDataFiltersState(),
  }),
};

declare module "@tanstack/react-table" {
  interface Plugins {
    dataFilteringFeature: typeof dataFilteringFeature;
  }
}
