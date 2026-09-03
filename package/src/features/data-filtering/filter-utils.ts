import { nanoid } from "nanoid";

import type {
	FilterCondition,
	FilterOperator,
	SerializedFilterCondition,
} from "../../types.ts";
import { FILTER_OPERATORS } from "./operators.ts";

export {
	deserializeDisplay,
	serializeDisplay,
} from "../display-snapshot.ts";

const OPERATOR_SET = new Set<string>(FILTER_OPERATORS);

export function serializeFilters(conditions: FilterCondition[]): string {
	const serialized: SerializedFilterCondition[] = conditions.map((c) => ({
		b: c.combinator,
		c: c.columnId,
		i: c.id,
		o: c.operator,
		v: c.value instanceof Date ? c.value.toISOString() : c.value,
	}));
	return JSON.stringify(serialized);
}

export function deserializeFilters(json: string): FilterCondition[] {
	if (!json) return [];
	let parsed: SerializedFilterCondition[];
	try {
		parsed = JSON.parse(json) as SerializedFilterCondition[];
	} catch {
		throw new Error("Invalid filter JSON");
	}
	if (!Array.isArray(parsed)) throw new Error("Invalid filter JSON");
	return parsed.map((s) => {
		if (!OPERATOR_SET.has(s.o)) {
			throw new Error(`Invalid operator "${String(s.o)}" in filter JSON`);
		}
		return {
			columnId: s.c,
			combinator: s.b === "or" ? ("or" as const) : ("and" as const),
			id: typeof s.i === "string" && s.i.length > 0 ? s.i : nanoid(),
			operator: s.o as FilterOperator,
			value: s.v,
		};
	});
}
