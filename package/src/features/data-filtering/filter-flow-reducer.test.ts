import { describe, expect, it } from "vitest";

import type { ColumnConfig } from "../../columns.ts";
import {
	resolveColumnSelect,
	resolveOperatorSelect,
} from "./filter-flow-reducer.ts";

function column(overrides: Partial<ColumnConfig> = {}): ColumnConfig {
	return { displayName: "Name", id: "name", type: "string", ...overrides };
}

describe("resolveColumnSelect", () => {
	it("pins search columns to contains/value", () => {
		expect(resolveColumnSelect(column({ id: "_search" }))).toEqual({
			operator: "contains",
			phase: "value",
		});
	});

	it("auto-commits nullary defaults", () => {
		expect(resolveColumnSelect(column({ operators: ["isEmpty"] }))).toEqual({
			autoCommit: "isEmpty",
		});
	});

	it("advances to operator otherwise", () => {
		expect(resolveColumnSelect(column())).toEqual({
			operator: "eq",
			phase: "operator",
		});
	});
});

describe("resolveOperatorSelect", () => {
	it("auto-commits nullary operators", () => {
		expect(resolveOperatorSelect("isEmpty")).toBe("autoCommit");
		expect(resolveOperatorSelect("eq")).toBe("advance");
	});
});
