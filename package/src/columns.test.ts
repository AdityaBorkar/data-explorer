import { describe, expect, it } from "vitest";

import { extractColumnConfigs } from "./columns.ts";

describe("extractColumnConfigs", () => {
	it("strips unknown meta keys instead of spreading them", () => {
		const configs = extractColumnConfigs([
			{
				id: "title",
				meta: {
					displayName: "Title",
					evil: "payload",
					type: "string",
				} as unknown as { displayName: string; type: "string" },
			},
		]);
		expect(configs).toHaveLength(1);
		expect(configs[0]).toEqual({
			displayName: "Title",
			id: "title",
			type: "string",
		});
		expect("evil" in (configs[0] as unknown as Record<string, unknown>)).toBe(
			false,
		);
	});

	it("passes quickOperator through", () => {
		const configs = extractColumnConfigs([
			{
				id: "tags",
				meta: {
					displayName: "Tags",
					quickOperator: "includeAll",
					type: "multiEnum",
				},
			},
		]);
		expect(configs[0]?.quickOperator).toBe("includeAll");
	});
});
