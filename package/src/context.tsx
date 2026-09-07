import { createContext, useContext } from "react";

import { MissingProviderError } from "./errors.ts";
import type { DataExplorerContextValue } from "./types.ts";

export const DataExplorerContext = createContext<DataExplorerContextValue<
	Record<string, unknown>
> | null>(null);

/**
 * Read the explorer context (table instance, column configs, data, view state).
 * Must run inside `<Provider>` — otherwise throws {@link MissingProviderError}.
 *
 * @example
 * ```tsx
 * const { table } = useDataExplorerContext<Task>();
 * const filters = table.state.dataFilters;
 * ```
 */
export function useDataExplorerContext<
	TItem extends Record<string, unknown> = Record<string, unknown>,
>(): DataExplorerContextValue<TItem> {
	const value = useContext(DataExplorerContext);
	if (!value) {
		throw new MissingProviderError("useDataExplorerContext");
	}
	return value as unknown as DataExplorerContextValue<TItem>;
}
