import type { FilterCondition, FilterGroup } from "../../types.ts";

function stableGroupId(
	combinator: "and" | "or",
	members: FilterCondition[],
	segment: number,
): string {
	const fingerprint = members.map((c) => c.id).join("+");
	return `group-${combinator}-${segment}-${members.length}-${fingerprint}`;
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
		const only = segments[0] as FilterCondition[];
		const root: "and" | "or" =
			conditions.length === 1
				? "and"
				: conditions.slice(1).every((c) => c.combinator === "or")
					? "or"
					: "and";
		return {
			combinator: root,
			conditions: [...only],
			id: stableGroupId(root, only, 0),
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
