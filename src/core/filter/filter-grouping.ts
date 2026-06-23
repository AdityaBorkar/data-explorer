import { nanoid } from "nanoid";

import type { FilterCondition, FilterGroup } from "../types";

export function groupConditions(conditions: FilterCondition[]): FilterGroup {
  if (conditions.length === 0) {
    return { combinator: "and", conditions: [], id: nanoid() };
  }

  const first = conditions[0];
  if (!first) {
    return { combinator: "and", conditions: [], id: nanoid() };
  }

  if (conditions.length === 1) {
    return {
      combinator: first.combinator,
      conditions: [first],
      id: nanoid(),
    };
  }

  const hasOr = conditions.some((c, i) => i > 0 && c.combinator === "or");
  const hasAnd = conditions.some((c, i) => i > 0 && c.combinator === "and");

  if (!hasOr) {
    return {
      combinator: "and",
      conditions: [...conditions],
      id: nanoid(),
    };
  }

  if (!hasAnd) {
    return {
      combinator: "or",
      conditions: [...conditions],
      id: nanoid(),
    };
  }

  const orRoot: FilterGroup = {
    combinator: "or",
    conditions: [],
    id: nanoid(),
  };

  let currentAndGroup: FilterGroup = {
    combinator: "and",
    conditions: [first],
    id: nanoid(),
  };

  for (let i = 1; i < conditions.length; i++) {
    const cond = conditions[i];
    if (!cond) continue;
    if (cond.combinator === "or") {
      orRoot.conditions.push(currentAndGroup);
      currentAndGroup = {
        combinator: "and",
        conditions: [cond],
        id: nanoid(),
      };
    } else {
      currentAndGroup.conditions.push(cond);
    }
  }

  orRoot.conditions.push(currentAndGroup);

  return orRoot;
}
