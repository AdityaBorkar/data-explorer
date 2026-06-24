import {
  assignTableAPIs,
  makeStateUpdater,
  type TableFeature,
} from "@tanstack/react-table";

import "./displayMetaFeature.types.ts";
import {
  getDefaultDisplayMetaState,
  table_resetDensity,
  table_resetViewType,
  table_setDensity,
  table_setViewType,
} from "./displayMetaFeature.utils.ts";

export const displayMetaFeature: TableFeature = {
  constructTableAPIs: (table) => {
    assignTableAPIs("displayMetaFeature", table, {
      table_resetDensity: {
        fn: (defaultState) => table_resetDensity(table, defaultState),
      },
      table_resetViewType: {
        fn: (defaultState) => table_resetViewType(table, defaultState),
      },
      table_setDensity: {
        fn: (updater) => table_setDensity(table, updater),
      },
      table_setViewType: {
        fn: (updater) => table_setViewType(table, updater),
      },
    });
  },

  getDefaultTableOptions: (table) => ({
    onDensityChange: makeStateUpdater("density", table),
    onViewTypeChange: makeStateUpdater("viewType", table),
  }),
  getInitialState: (initialState) => ({
    ...initialState,
    ...getDefaultDisplayMetaState(),
  }),
};

declare module "@tanstack/react-table" {
  interface Plugins {
    displayMetaFeature: typeof displayMetaFeature;
  }
}
