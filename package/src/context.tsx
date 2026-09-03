import { createContext, useContext } from "react";

import type { ContextType } from "./types.ts";

export const DataExplorerContext = createContext<ContextType | null>(null);

export function useDataExplorerContext<TItem = unknown>(): ContextType<TItem> {
	const value = useContext(DataExplorerContext);
	if (!value) {
		throw new Error(
			"useDataExplorerContext must be used within DataExplorerProvider",
		);
	}
	return value as ContextType<TItem>;
}

// Re-exported here so the vendored `context.tsx` path keeps working;
// new code should import from `./hooks/use-selection.ts`.
export type { SelectionState } from "./hooks/use-selection.ts";
export { useSelectionContext } from "./hooks/use-selection.ts";
