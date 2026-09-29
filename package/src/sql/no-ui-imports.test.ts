import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * Import-graph constraint for the `backend` entry (spec §8): the transitive
 * in-package closure reachable from the backend sources must stay server-safe
 * — no React, TanStack, zod, or UI/flow modules. Static source scan over
 * relative imports; no module loading, so this runs in the plain node env.
 */

const SRC_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const ENTRIES = ["sql/backend.ts", "sql/pg-where.ts", "sql/pg-identifiers.ts"];

/** The entire allowed transitive in-package closure (spec §8). */
const ALLOWED = new Set([
	...ENTRIES,
	"columns.ts",
	"errors.ts",
	"filters.ts",
	"sql/filter-sql.ts",
	"sql/index.ts",
	"features/data-filtering/filter-draft.ts",
	"features/data-filtering/filter-grouping.ts",
	"features/data-filtering/filter-semantics.ts",
	"features/data-filtering/operators.ts",
]);

/** Bare specifiers that must never appear anywhere in the closure. */
const FORBIDDEN_BARE = [
	/^react($|\/)/,
	/^react-dom($|\/)/,
	/^@tanstack\//,
	/^zod($|\/)/,
];

/**
 * Known offender fragments (defense in depth — the allow-list already
 * excludes them; matching by fragment keeps failure messages actionable).
 */
const FORBIDDEN_FRAGMENTS = [
	"provider.tsx",
	"context.tsx",
	"types.ts",
	"hooks/",
	"features/display-",
	"filter-condition-schema",
	"dataFilteringFeature",
	"filter-utils",
	"use-inline-filter-flow",
	"filter-flow-reducer",
	"components/",
];

/** Matches `from "…"`, `import "…"`, and dynamic `import("…")`. */
const SPECIFIER_RE =
	/(?:\bfrom\s*|\bimport\s*|\bimport\s*\(\s*)["']([^"']+)["']/g;

/** Strip block and line comments so doc examples don't read as imports. */
function stripComments(source: string): string {
	return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function resolveRelative(fromFile: string, spec: string): string | undefined {
	const abs = resolve(dirname(join(SRC_DIR, fromFile)), spec);
	const rel = relative(SRC_DIR, abs);
	if (rel.startsWith("..") || rel === "") return undefined;
	if (existsSync(abs)) return rel;
	for (const candidate of [`${rel}.ts`, `${rel}.tsx`, join(rel, "index.ts")]) {
		if (existsSync(join(SRC_DIR, candidate))) return candidate;
	}
	return undefined;
}

function walk(entries: readonly string[]): {
	bare: Set<string>;
	violations: string[];
} {
	const bare = new Set<string>();
	const violations: string[] = [];
	const seen = new Set<string>();
	const queue = [...entries];

	while (queue.length > 0) {
		const file = queue.shift() as string;
		if (seen.has(file)) continue;
		seen.add(file);

		if (!ALLOWED.has(file)) {
			violations.push(`${file}: outside the backend allow-list`);
			continue;
		}
		for (const fragment of FORBIDDEN_FRAGMENTS) {
			if (file.includes(fragment)) {
				violations.push(`${file}: matches forbidden "${fragment}"`);
			}
		}

		const source = stripComments(readFileSync(join(SRC_DIR, file), "utf8"));
		for (const match of source.matchAll(SPECIFIER_RE)) {
			const spec = match[1] as string;
			if (spec.startsWith(".")) {
				const resolved = resolveRelative(file, spec);
				if (resolved) queue.push(resolved);
				else violations.push(`${file}: unresolvable import "${spec}"`);
			} else if (spec.startsWith("#/")) {
				violations.push(
					`${file}: backend must use relative imports, got "${spec}"`,
				);
			} else {
				bare.add(spec);
				if (FORBIDDEN_BARE.some((re) => re.test(spec))) {
					violations.push(`${file}: forbidden import "${spec}"`);
				}
			}
		}
	}

	return { bare, violations };
}

describe("backend import-graph constraint", () => {
	it("stays within the allow-list with no React / TanStack / zod in the closure", () => {
		expect(walk(ENTRIES).violations).toEqual([]);
	});

	it("keeps nanoid as the only external import in the closure", () => {
		const { bare } = walk(ENTRIES);
		expect([...bare].filter((spec) => spec !== "nanoid")).toEqual([]);
	});

	it("fails when a UI file enters the closure (e.g. provider.tsx)", () => {
		const { violations } = walk(["provider.tsx"]);
		expect(violations.some((v) => v.includes("provider.tsx"))).toBe(true);
	});
});
