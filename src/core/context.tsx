import { createContext, useContext } from "react";

import type {
  CallbackContextType,
  ConfigContextType,
  ContextType,
  DataContextType,
  DisplayContextType,
  FilterContextType,
  SelectionContextType,
  ViewContextType,
} from "./types.ts";

export const ConfigContext = createContext<ConfigContextType | null>(null);
export const FilterContext = createContext<FilterContextType | null>(null);
export const DisplayContext = createContext<DisplayContextType | null>(null);
export const SelectionContext = createContext<SelectionContextType | null>(
  null,
);
// biome-ignore lint/suspicious/noExplicitAny: generic context needs any to preserve type parameter
export const DataContext = createContext<DataContextType<any> | null>(null);
export const ViewContext = createContext<ViewContextType | null>(null);
export const CallbackContext = createContext<CallbackContextType | null>(null);

function useNonNullContext<T>(ctx: React.Context<T | null>, name: string): T {
  const value = useContext(ctx);
  if (!value) {
    throw new Error(`${name} must be used within DataExplorerProvider`);
  }
  return value;
}

export function useConfigContext(): ConfigContextType {
  return useNonNullContext(ConfigContext, "useConfigContext");
}

export function useFilterContext(): FilterContextType {
  return useNonNullContext(FilterContext, "useFilterContext");
}

export function useDisplayContext(): DisplayContextType {
  return useNonNullContext(DisplayContext, "useDisplayContext");
}

export function useSelectionContext(): SelectionContextType {
  return useNonNullContext(SelectionContext, "useSelectionContext");
}

export function useDataContext<TItem = unknown>(): DataContextType<TItem> {
  return useNonNullContext(
    DataContext,
    "useDataContext",
  ) as DataContextType<TItem>;
}

export function useViewContext(): ViewContextType {
  return useNonNullContext(ViewContext, "useViewContext");
}

export function useCallbackContext(): CallbackContextType {
  return useNonNullContext(CallbackContext, "useCallbackContext");
}

export function useDataExplorerContext<TItem = unknown>(): ContextType<TItem> {
  return {
    ...useConfigContext(),
    ...useFilterContext(),
    ...useDisplayContext(),
    ...useSelectionContext(),
    ...useDataContext<TItem>(),
    ...useViewContext(),
    ...useCallbackContext(),
  };
}
