import type { FilterCondition, FilterViewDisplay } from "./types.ts";

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
