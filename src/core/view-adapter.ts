import type { FilterCondition, FilterViewDisplay } from "./types";

export interface View {
  id: string;
  name: string;
  display: FilterViewDisplay;
  refine: FilterCondition[];
}

export interface ViewAdapter {
  listViews: (domain: string) => Promise<View[]>;
  updateView: (
    id: string,
    data: { display: FilterViewDisplay; refine: FilterCondition[] },
  ) => Promise<void>;
}
