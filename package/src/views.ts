import type { FilterCondition } from "./filters.ts";

export type ViewType = "table" | "board" | "timeline";
export type Density = "compact" | "comfortable" | "spacious";

export interface View {
	display: FilterViewDisplay;
	id: string;
	name: string;
	refine: FilterCondition[];
}

export interface ViewAdapter {
	/** Optional: required by `createView`. */
	createView?: (
		domain: string,
		data: {
			display: FilterViewDisplay;
			name: string;
			refine: FilterCondition[];
		},
	) => Promise<View>;
	/** Optional: required by `deleteView`. */
	deleteView?: (id: string) => Promise<void>;
	listViews: (domain: string) => Promise<View[]>;
	/** Optional: required by `renameView`. */
	renameView?: (id: string, name: string) => Promise<View>;
	updateView: (
		id: string,
		data: { display: FilterViewDisplay; refine: FilterCondition[] },
	) => Promise<void>;
}

export interface FilterViewDisplay {
	columnWidths: Record<string, number>;
	density: Density;
	fields: string[];
	groupBy: string | null;
	orderBy: string;
	orderType: "asc" | "desc";
	type: ViewType;
}
