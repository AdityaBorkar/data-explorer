import { describe, expect, it } from "vitest";

import type { FilterViewDisplay } from "../views.ts";
import {
	deserializeDisplay,
	mergeDisplay,
	serializeDisplay,
} from "./display-snapshot.ts";

const BASE: FilterViewDisplay = {
	columnWidths: {},
	density: "comfortable",
	fields: ["name", "slug"],
	groupBy: null,
	orderBy: "createdAt",
	orderType: "desc",
	type: "table",
};

describe("mergeDisplay", () => {
	it("returns base when no overrides", () => {
		const result = mergeDisplay(BASE, {});
		expect(result).toEqual(BASE);
	});

	it("overrides individual fields", () => {
		const result = mergeDisplay(BASE, { density: "compact", orderBy: "name" });
		expect(result.density).toBe("compact");
		expect(result.orderBy).toBe("name");
		expect(result.orderType).toBe("desc");
		expect(result.type).toBe("table");
	});

	it("respects type and groupBy overrides", () => {
		const result = mergeDisplay(BASE, { groupBy: "status", type: "board" });
		expect(result.type).toBe("board");
		expect(result.groupBy).toBe("status");
	});

	it("merges column widths per column instead of replacing them", () => {
		const base: FilterViewDisplay = {
			...BASE,
			columnWidths: { name: 100, slug: 150 },
		};
		const result = mergeDisplay(base, { columnWidths: { name: 200 } });
		expect(result.columnWidths).toEqual({ name: 200, slug: 150 });
	});
});

describe("serializeDisplay / deserializeDisplay", () => {
	it("serializes and deserializes display state", () => {
		const params = serializeDisplay(BASE);
		const result = deserializeDisplay(params, BASE);

		expect(result.orderBy).toBe("createdAt");
		expect(result.orderType).toBe("desc");
		expect(result.fields).toEqual(["name", "slug"]);
		expect(result.density).toBe("comfortable");
		expect(result.type).toBe("table");
		expect(result.groupBy).toBeNull();
	});

	it("overrides individual display params", () => {
		const params = new URLSearchParams();
		params.set("sort", "name");
		params.set("dir", "asc");
		params.set("cols", "name,legalName,slug");
		params.set("density", "compact");
		params.set("widths", JSON.stringify({ name: 200 }));
		params.set("type", "board");
		params.set("groupBy", "status");

		const result = deserializeDisplay(params, BASE);

		expect(result.orderBy).toBe("name");
		expect(result.orderType).toBe("asc");
		expect(result.fields).toEqual(["name", "legalName", "slug"]);
		expect(result.density).toBe("compact");
		expect(result.columnWidths).toEqual({ name: 200 });
		expect(result.type).toBe("board");
		expect(result.groupBy).toBe("status");
	});

	it("falls back to defaults for missing params", () => {
		const params = new URLSearchParams();
		const result = deserializeDisplay(params, BASE);

		expect(result.orderBy).toBe("createdAt");
		expect(result.orderType).toBe("desc");
		expect(result.density).toBe("comfortable");
	});
});
