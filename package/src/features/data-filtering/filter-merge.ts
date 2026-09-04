import type { FilterCondition } from "../../types.ts";
import { mergeDisplay } from "../display-snapshot.ts";

/**
 * @deprecated Import from `../display-snapshot.ts` (canonical home).
 * Kept as a shim for one minor.
 */
export { mergeDisplay };

export function stableStringify(value: unknown): string {
	if (value === null) return "null";
	if (value === undefined) return "undefined";
	if (value instanceof Date) return `Date:${value.toISOString()}`;
	if (typeof value !== "object") return JSON.stringify(value) ?? "unknown";
	if (Array.isArray(value)) {
		return `[${value.map((v) => stableStringify(v)).join(",")}]`;
	}
	const entries = Object.entries(value as Record<string, unknown>)
		.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
		.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
	return `{${entries.join(",")}}`;
}

export function filterKey(cond: FilterCondition): string {
	return `${cond.columnId}::${cond.operator}::${cond.combinator}::${stableStringify(cond.value)}`;
}

export function conditionsEqual(
	a: FilterCondition,
	b: FilterCondition,
): boolean {
	return filterKey(a) === filterKey(b);
}

function keyedMultiset<T>(
	items: T[],
	keyOf: (item: T) => string,
): Map<string, T[]> {
	const pool = new Map<string, T[]>();
	for (const item of items) {
		const key = keyOf(item);
		const list = pool.get(key);
		if (list) list.push(item);
		else pool.set(key, [item]);
	}
	return pool;
}

/** Cache `filterKey` per condition id so merge paths hash each item once. */
function keyCache(items: FilterCondition[]): Map<string, string> {
	const cache = new Map<string, string>();
	for (const item of items) {
		if (!cache.has(item.id)) cache.set(item.id, filterKey(item));
	}
	return cache;
}

/**
 * Merge by id first, then by structural key with multiset matching so
 * duplicate column+operator conditions are preserved instead of collapsing.
 */
export function mergeFilters(
	base: FilterCondition[],
	overrides: FilterCondition[],
): FilterCondition[] {
	const keys = keyCache([...base, ...overrides]);
	const baseIds = new Set(base.map((b) => b.id));
	const structuralPool = keyedMultiset(
		overrides.filter((o) => !baseIds.has(o.id)),
		(o) => keys.get(o.id) as string,
	);

	const overridesById = new Map(overrides.map((o) => [o.id, o]));
	const consumed = new Set<string>();
	const result: FilterCondition[] = base.map((b) => {
		const byId = overridesById.get(b.id);
		if (byId) {
			consumed.add(byId.id);
			return byId;
		}
		const key = keys.get(b.id) as string;
		const pool = structuralPool.get(key);
		const structural = pool?.shift();
		if (structural) {
			consumed.add(structural.id);
			if (pool?.length === 0) structuralPool.delete(key);
			return structural;
		}
		return b;
	});

	for (const o of overrides) {
		if (!consumed.has(o.id)) result.push(o);
	}

	return result;
}

export function computeOverrides(
	base: FilterCondition[],
	effective: FilterCondition[],
): FilterCondition[] {
	const overrides: FilterCondition[] = [];
	const baseById = new Map(base.map((b) => [b.id, b]));
	const remaining = keyedMultiset(base, (b) => filterKey(b));

	for (const f of effective) {
		const direct = baseById.get(f.id);
		if (direct) {
			if (!conditionsEqual(direct, f)) overrides.push(f);
			continue;
		}
		const key = filterKey(f);
		const pool = remaining.get(key);
		const candidate = pool?.shift();
		if (pool?.length === 0) remaining.delete(key);
		if (!candidate || !conditionsEqual(candidate, f)) overrides.push(f);
	}

	return overrides;
}
