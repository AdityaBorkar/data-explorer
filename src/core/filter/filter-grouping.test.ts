import { describe, expect, it } from "vitest";

import type { FilterCondition } from "../types";
import { groupConditions } from "./filter-grouping";

function cond(
  columnId: string,
  operator: "eq",
  value: unknown,
  combinator: "and" | "or",
): FilterCondition {
  return {
    columnId,
    combinator,
    id: `id-${columnId}-${combinator}`,
    operator,
    value,
  };
}

describe("groupConditions", () => {
  it("returns empty AND group for empty array", () => {
    const result = groupConditions([]);
    expect(result.combinator).toBe("and");
    expect(result.conditions).toHaveLength(0);
  });

  it("returns single-condition group for single condition", () => {
    const c = cond("name", "eq", "foo", "and");
    const result = groupConditions([c]);
    expect(result.combinator).toBe("and");
    expect(result.conditions).toHaveLength(1);
    expect(result.conditions[0]).toBe(c);
  });

  it("groups all-AND conditions into single AND group", () => {
    const a = cond("name", "eq", "a", "and");
    const b = cond("slug", "eq", "b", "and");
    const result = groupConditions([a, b]);
    expect(result.combinator).toBe("and");
    expect(result.conditions).toHaveLength(2);
  });

  it("groups all-OR conditions into single OR group", () => {
    const a = cond("name", "eq", "a", "and");
    const b = cond("slug", "eq", "b", "or");
    const result = groupConditions([a, b]);
    expect(result.combinator).toBe("or");
    expect(result.conditions).toHaveLength(2);
  });

  it("splits A AND B OR C into OR(AND(A,B), C)", () => {
    const a = cond("name", "eq", "a", "and");
    const b = cond("slug", "eq", "b", "and");
    const c = cond("legalName", "eq", "c", "or");
    const result = groupConditions([a, b, c]);

    expect(result.combinator).toBe("or");
    expect(result.conditions).toHaveLength(2);

    const firstGroup = result.conditions[0] as {
      combinator: string;
      conditions: unknown[];
    };
    expect(firstGroup.combinator).toBe("and");
    expect(firstGroup.conditions).toHaveLength(2);

    const secondItem = result.conditions[1] as {
      combinator: string;
      conditions: unknown[];
    };
    expect(secondItem.combinator).toBe("and");
    expect(secondItem.conditions).toHaveLength(1);
  });

  it("splits A AND B OR C AND D into OR(AND(A,B), AND(C,D))", () => {
    const a = cond("name", "eq", "a", "and");
    const b = cond("slug", "eq", "b", "and");
    const c = cond("legalName", "eq", "c", "or");
    const d = cond("archived", "eq", "true", "and");
    const result = groupConditions([a, b, c, d]);

    expect(result.combinator).toBe("or");
    expect(result.conditions).toHaveLength(2);

    const firstGroup = result.conditions[0] as {
      combinator: string;
      conditions: unknown[];
    };
    expect(firstGroup.combinator).toBe("and");
    expect(firstGroup.conditions).toHaveLength(2);

    const secondGroup = result.conditions[1] as {
      combinator: string;
      conditions: unknown[];
    };
    expect(secondGroup.combinator).toBe("and");
    expect(secondGroup.conditions).toHaveLength(2);
  });

  it("handles OR at start: A OR B AND C → OR(AND(A), AND(B,C))", () => {
    const a = cond("name", "eq", "a", "and");
    const b = cond("slug", "eq", "b", "or");
    const c = cond("legalName", "eq", "c", "and");
    const result = groupConditions([a, b, c]);

    expect(result.combinator).toBe("or");
    expect(result.conditions).toHaveLength(2);

    const firstGroup = result.conditions[0] as {
      combinator: string;
      conditions: FilterCondition[];
    };
    expect(firstGroup.combinator).toBe("and");
    expect(firstGroup.conditions).toHaveLength(1);
    expect(firstGroup.conditions[0]?.columnId).toBe("name");

    const secondGroup = result.conditions[1] as {
      combinator: string;
      conditions: FilterCondition[];
    };
    expect(secondGroup.combinator).toBe("and");
    expect(secondGroup.conditions).toHaveLength(2);
    expect(secondGroup.conditions[0]?.columnId).toBe("slug");
    expect(secondGroup.conditions[1]?.columnId).toBe("legalName");
  });

  it("handles AND at end: A OR B OR C AND D", () => {
    const a = cond("name", "eq", "a", "and");
    const b = cond("slug", "eq", "b", "or");
    const c = cond("legalName", "eq", "c", "or");
    const d = cond("archived", "eq", "true", "and");
    const result = groupConditions([a, b, c, d]);

    expect(result.combinator).toBe("or");

    const firstGroup = result.conditions[0] as {
      combinator: string;
      conditions: FilterCondition[];
    };
    expect(firstGroup.combinator).toBe("and");
    expect(firstGroup.conditions).toHaveLength(1);

    const lastGroup = result.conditions[result.conditions.length - 1] as {
      combinator: string;
      conditions: FilterCondition[];
    };
    expect(lastGroup.combinator).toBe("and");
    expect(lastGroup.conditions).toHaveLength(2);
  });

  it("preserves combinator field on conditions inside the tree", () => {
    const a = cond("name", "eq", "a", "and");
    const b = cond("slug", "eq", "b", "and");
    const c = cond("legalName", "eq", "c", "or");
    const result = groupConditions([a, b, c]);

    const andGroup = result.conditions[0] as { conditions: FilterCondition[] };
    expect(andGroup.conditions[0]?.combinator).toBe("and");
    expect(andGroup.conditions[1]?.combinator).toBe("and");

    const orCond = (result.conditions[1] as { conditions: FilterCondition[] })
      .conditions[0];
    expect(orCond?.combinator).toBe("or");
  });
});
