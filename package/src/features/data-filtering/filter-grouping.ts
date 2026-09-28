import type { FilterCondition, FilterGroup } from "../../types.ts";

/**
 * Bounded deterministic group id: a short hash of the member ids so ids
 * stay stable across renders without growing with the filter count.
 */
function hashIds(ids: string[]): string {
	let hash = 5381;
	for (const id of ids) {
		for (let i = 0; i < id.length; i++) {
			hash = (hash * 33 + id.charCodeAt(i)) | 0;
		}
		hash = (hash * 33 + 31) | 0;
	}
	return (hash >>> 0).toString(36);
}

function stableGroupId(
	combinator: "and" | "or",
	members: FilterCondition[],
	segment: number,
): string {
	return `group-${combinator}-${segment}-${members.length}-${hashIds(members.map((c) => c.id))}`;
}

/**
 * Fold a flat condition list into an AND-precedence tree with an OR root.
 * Ids are deterministic derivations of member ids so repeated calls with
 * the same input produce stable keys across renders.
 */
export function groupConditions(conditions: FilterCondition[]): FilterGroup {
	if (conditions.length === 0) {
		return { combinator: "and", conditions: [], id: "group-empty" };
	}

	const first = conditions[0] as FilterCondition;
	const segments: FilterCondition[][] = [[first]];
	for (const cond of conditions.slice(1)) {
		if (cond.combinator === "or") {
			segments.push([cond]);
		} else {
			const current = segments[segments.length - 1];
			if (current) current.push(cond);
		}
	}

	if (segments.length === 1) {
		// A single segment means no `or` combinator was seen (each `or`
		// starts a new segment), so the root is always `and`.
		const only = segments[0] as FilterCondition[];
		return {
			combinator: "and",
			conditions: [...only],
			id: stableGroupId("and", only, 0),
		};
	}

	return {
		combinator: "or",
		conditions: segments.map((members, i) => ({
			combinator: "and" as const,
			conditions: [...members],
			id: stableGroupId("and", members, i),
		})),
		id: stableGroupId("or", segments.flat(), segments.length),
	};
}
