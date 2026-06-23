import type { FilterCondition, FilterViewDisplay } from "../types";

export function filterKey(cond: FilterCondition): string {
  return `${cond.columnId}::${cond.operator}`;
}

export function conditionsEqual(
  a: FilterCondition,
  b: FilterCondition,
): boolean {
  return (
    a.columnId === b.columnId &&
    a.operator === b.operator &&
    a.combinator === b.combinator &&
    JSON.stringify(a.value) === JSON.stringify(b.value)
  );
}

export function mergeFilters(
  base: FilterCondition[],
  overrides: FilterCondition[],
): FilterCondition[] {
  const overrideMap = new Map(overrides.map((o) => [filterKey(o), o]));
  const result: FilterCondition[] = [];

  for (const b of base) {
    const key = filterKey(b);
    const override = overrideMap.get(key);
    if (override !== undefined) {
      result.push(override);
      overrideMap.delete(key);
    } else {
      result.push(b);
    }
  }

  for (const o of overrideMap.values()) {
    result.push(o);
  }

  return result;
}

export function computeOverrides(
  base: FilterCondition[],
  effective: FilterCondition[],
): FilterCondition[] {
  const overrides: FilterCondition[] = [];
  const baseMap = new Map(base.map((b) => [filterKey(b), b]));

  for (const f of effective) {
    const key = filterKey(f);
    const baseFilter = baseMap.get(key);
    if (!baseFilter || !conditionsEqual(baseFilter, f)) {
      overrides.push(f);
    }
  }

  return overrides;
}

export function mergeDisplay(
  base: FilterViewDisplay,
  overrides: Partial<FilterViewDisplay>,
): FilterViewDisplay {
  return {
    columnWidths: overrides.columnWidths ?? base.columnWidths,
    density: overrides.density ?? base.density,
    fields: overrides.fields ?? base.fields,
    groupBy: overrides.groupBy ?? base.groupBy,
    orderBy: overrides.orderBy ?? base.orderBy,
    orderType: overrides.orderType ?? base.orderType,
    type: base.type,
  };
}
