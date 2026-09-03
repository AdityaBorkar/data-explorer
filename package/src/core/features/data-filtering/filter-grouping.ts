import { nanoid } from "nanoid";

import type { FilterCondition, FilterGroup } from "../../types.ts";

export function groupConditions(conditions: FilterCondition[]): FilterGroup {
	const [first] = conditions;
	if (!first) {
		return { combinator: "and", conditions: [], id: nanoid() };
	}

	if (conditions.length === 1) {
		return {
			combinator: first.combinator,
			conditions: [first],
			id: nanoid(),
		};
	}

	const rest = conditions.slice(1);
	const hasOr = rest.some((c) => c.combinator === "or");
	const hasAnd = rest.some((c) => c.combinator === "and");

	if (!hasOr) {
		return {
			combinator: "and",
			conditions: [...conditions],
			id: nanoid(),
		};
	}

	if (!hasAnd) {
		return {
			combinator: "or",
			conditions: [...conditions],
			id: nanoid(),
		};
	}

	const orRoot: FilterGroup = {
		combinator: "or",
		conditions: [],
		id: nanoid(),
	};

	let currentAndGroup: FilterGroup = {
		combinator: "and",
		conditions: [first],
		id: nanoid(),
	};

	for (const cond of rest) {
		if (cond.combinator === "or") {
			orRoot.conditions.push(currentAndGroup);
			currentAndGroup = {
				combinator: "and",
				conditions: [cond],
				id: nanoid(),
			};
		} else {
			currentAndGroup.conditions.push(cond);
		}
	}

	orRoot.conditions.push(currentAndGroup);

	return orRoot;
}
