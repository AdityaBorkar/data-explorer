import { describe, expect, it } from "vitest";

import { escapeLikePattern, pgColRef, quotePgIdent } from "./pg-identifiers.ts";

describe("quotePgIdent", () => {
	it("wraps plain names in double quotes", () => {
		expect(quotePgIdent("title")).toBe('"title"');
	});

	it("doubles embedded double quotes", () => {
		expect(quotePgIdent('weird"name')).toBe('"weird""name"');
	});
});

describe("pgColRef", () => {
	it("quotes the bare column without alias", () => {
		expect(pgColRef("title")).toBe('"title"');
	});

	it("qualifies with the table alias", () => {
		expect(pgColRef("title", "tasks")).toBe('"tasks"."title"');
	});

	it("quotes alias and column independently", () => {
		expect(pgColRef('co"l', 'ta"ble')).toBe('"ta""ble"."co""l"');
	});
});

describe("escapeLikePattern", () => {
	it("escapes backslash, percent and underscore", () => {
		expect(escapeLikePattern("a%b_c\\d")).toBe("a\\%b\\_c\\\\d");
	});

	it("leaves wildcard-free input untouched", () => {
		expect(escapeLikePattern("plain text")).toBe("plain text");
	});

	it("double-passes already-escaped input (the backslash itself is escaped)", () => {
		expect(escapeLikePattern("\\_")).toBe("\\\\\\_");
		expect(escapeLikePattern(escapeLikePattern("50%"))).toBe("50\\\\\\%");
	});
});
