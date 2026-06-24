import { nanoid } from "nanoid";

import type {
  FilterCondition,
  FilterViewDisplay,
  SerializedFilterCondition,
} from "../../types.ts";

export function serializeFilters(conditions: FilterCondition[]): string {
  const serialized: SerializedFilterCondition[] = conditions.map((c) => ({
    b: c.combinator,
    c: c.columnId,
    o: c.operator,
    v: c.value instanceof Date ? c.value.toISOString() : c.value,
  }));
  return JSON.stringify(serialized);
}

export function deserializeFilters(json: string): FilterCondition[] {
  if (!json) return [];
  const parsed: SerializedFilterCondition[] = JSON.parse(json);
  return parsed.map((s) => ({
    columnId: s.c,
    combinator: s.b,
    id: nanoid(),
    operator: s.o as FilterCondition["operator"],
    value: s.v,
  }));
}

export function serializeDisplay(display: FilterViewDisplay): URLSearchParams {
  const params = new URLSearchParams();
  params.set("sort", display.orderBy);
  params.set("dir", display.orderType);
  params.set("cols", display.fields.join(","));
  if (Object.keys(display.columnWidths).length > 0) {
    params.set("widths", JSON.stringify(display.columnWidths));
  }
  params.set("density", display.density);
  return params;
}

export function deserializeDisplay(
  params: URLSearchParams,
  defaults: FilterViewDisplay,
): FilterViewDisplay {
  const rawWidths = params.get("widths");
  const rawCols = params.get("cols");
  const rawDensity = params.get("density");
  const rawDir = params.get("dir");

  return {
    columnWidths: rawWidths ? JSON.parse(rawWidths) : defaults.columnWidths,
    density: (rawDensity as FilterViewDisplay["density"]) ?? defaults.density,
    fields: rawCols ? rawCols.split(",") : defaults.fields,
    groupBy: defaults.groupBy,
    orderBy: params.get("sort") ?? defaults.orderBy,
    orderType: (rawDir as FilterViewDisplay["orderType"]) ?? defaults.orderType,
    type: defaults.type,
  };
}
