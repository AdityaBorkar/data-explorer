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
	listViews: (domain: string) => Promise<View[]>;
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
