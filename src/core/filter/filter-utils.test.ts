import { describe, expect, it } from "vitest";

import type { FilterCondition, FilterViewDisplay } from "../types";
import {
  deserializeDisplay,
  deserializeFilters,
  serializeDisplay,
  serializeFilters,
} from "./filter-utils";

function cond(
  columnId: string,
  operator: "eq" | "contains" | "between" | "in" | "isEmpty",
  value: unknown,
  combinator: "and" | "or",
): FilterCondition {
  return { columnId, combinator, id: "test-id", operator, value };
}

describe("serializeFilters / deserializeFilters", () => {
  it("round-trips basic conditions", () => {
    const conditions: FilterCondition[] = [
      cond("name", "eq", "foo", "and"),
      cond("archived", "eq", "true", "or"),
    ];
    const json = serializeFilters(conditions);
    const result = deserializeFilters(json);

    expect(result).toHaveLength(2);
    expect(result[0]?.columnId).toBe("name");
    expect(result[0]?.operator).toBe("eq");
    expect(result[0]?.value).toBe("foo");
    expect(result[0]?.combinator).toBe("and");
    expect(result[1]?.columnId).toBe("archived");
    expect(result[1]?.combinator).toBe("or");
  });

  it("regenerates nanoid IDs on deserialize", () => {
    const conditions = [cond("name", "eq", "foo", "and")];
    const json = serializeFilters(conditions);
    const result = deserializeFilters(json);

    expect(result[0]?.id).not.toBe("test-id");
    expect(result[0]?.id).toBeTruthy();
  });

  it("handles null values (isEmpty)", () => {
    const conditions: FilterCondition[] = [
      {
        columnId: "name",
        combinator: "and",
        id: "x",
        operator: "isEmpty",
        value: null,
      },
    ];
    const json = serializeFilters(conditions);
    const result = deserializeFilters(json);

    expect(result[0]?.value).toBeNull();
  });

  it("handles between tuples", () => {
    const conditions: FilterCondition[] = [
      {
        columnId: "createdAt",
        combinator: "and",
        id: "x",
        operator: "between",
        value: ["2024-01-01", "2024-12-31"],
      },
    ];
    const json = serializeFilters(conditions);
    const result = deserializeFilters(json);

    expect(result[0]?.value).toEqual(["2024-01-01", "2024-12-31"]);
  });

  it("handles string arrays for in/notIn", () => {
    const conditions: FilterCondition[] = [
      {
        columnId: "assigneeId",
        combinator: "and",
        id: "x",
        operator: "in",
        value: ["user-1", "user-2"],
      },
    ];
    const json = serializeFilters(conditions);
    const result = deserializeFilters(json);

    expect(result[0]?.value).toEqual(["user-1", "user-2"]);
  });

  it("handles empty array", () => {
    const json = serializeFilters([]);
    const result = deserializeFilters(json);
    expect(result).toHaveLength(0);
  });

  it("serializes Date values as ISO strings", () => {
    const date = new Date("2024-06-15T12:00:00.000Z");
    const conditions: FilterCondition[] = [
      {
        columnId: "createdAt",
        combinator: "and",
        id: "x",
        operator: "eq",
        value: date,
      },
    ];
    const json = serializeFilters(conditions);
    const parsed = JSON.parse(json) as { v: string }[];
    expect(parsed[0]?.v).toBe("2024-06-15T12:00:00.000Z");
  });
});

describe("serializeDisplay / deserializeDisplay", () => {
  const defaults: FilterViewDisplay = {
    columnWidths: {},
    density: "comfortable",
    fields: ["name", "slug"],
    groupBy: null,
    orderBy: "createdAt",
    orderType: "desc",
    type: "table",
  };

  it("serializes and deserializes display state", () => {
    const params = serializeDisplay(defaults);
    const result = deserializeDisplay(params, defaults);

    expect(result.orderBy).toBe("createdAt");
    expect(result.orderType).toBe("desc");
    expect(result.fields).toEqual(["name", "slug"]);
    expect(result.density).toBe("comfortable");
  });

  it("overrides individual display params", () => {
    const params = new URLSearchParams();
    params.set("sort", "name");
    params.set("dir", "asc");
    params.set("cols", "name,legalName,slug");
    params.set("density", "compact");
    params.set("widths", JSON.stringify({ name: 200 }));

    const result = deserializeDisplay(params, defaults);

    expect(result.orderBy).toBe("name");
    expect(result.orderType).toBe("asc");
    expect(result.fields).toEqual(["name", "legalName", "slug"]);
    expect(result.density).toBe("compact");
    expect(result.columnWidths).toEqual({ name: 200 });
  });

  it("falls back to defaults for missing params", () => {
    const params = new URLSearchParams();
    const result = deserializeDisplay(params, defaults);

    expect(result.orderBy).toBe("createdAt");
    expect(result.orderType).toBe("desc");
    expect(result.density).toBe("comfortable");
  });
});
