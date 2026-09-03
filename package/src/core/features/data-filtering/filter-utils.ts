import { nanoid } from "nanoid";

import type {
	FilterCondition,
	FilterOperator,
	FilterViewDisplay,
	SerializedFilterCondition,
} from "../../types.ts";
import { FILTER_OPERATORS } from "./operators.ts";

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

const DENSITIES = ["compact", "comfortable", "spacious"] as const;
const DIRS = ["asc", "desc"] as const;
const VIEW_TYPES = ["table", "board", "timeline"] as const;

export function serializeDisplay(display: FilterViewDisplay): URLSearchParams {
	const params = new URLSearchParams();
	params.set("sort", display.orderBy);
	params.set("dir", display.orderType);
	params.delete("cols");
	for (const field of display.fields) params.append("cols", field);
	if (Object.keys(display.columnWidths).length > 0) {
		params.set("widths", JSON.stringify(display.columnWidths));
	}
	params.set("density", display.density);
	params.set("type", display.type);
	if (display.groupBy) params.set("groupBy", display.groupBy);
	return params;
}

export function deserializeDisplay(
	params: URLSearchParams,
	defaults: FilterViewDisplay,
): FilterViewDisplay {
	const rawWidths = params.get("widths");
	const rawDensity = params.get("density");
	const rawDir = params.get("dir");
	const rawType = params.get("type");
	const rawGroupBy = params.get("groupBy");
	const rawSort = params.get("sort");

	let columnWidths = defaults.columnWidths;
	if (rawWidths) {
		try {
			columnWidths = JSON.parse(rawWidths) as Record<string, number>;
		} catch {
			columnWidths = defaults.columnWidths;
		}
	}

	const cols = params
		.getAll("cols")
		.flatMap((v) => v.split(","))
		.map((v) => v.trim())
		.filter(Boolean);
	const fields = cols.length > 0 ? cols : defaults.fields;

	return {
		columnWidths,
		density: (DENSITIES as readonly string[]).includes(rawDensity ?? "")
			? (rawDensity as FilterViewDisplay["density"])
			: defaults.density,
		fields,
		groupBy: rawGroupBy || defaults.groupBy,
		orderBy: rawSort || defaults.orderBy,
		orderType: (DIRS as readonly string[]).includes(rawDir ?? "")
			? (rawDir as FilterViewDisplay["orderType"])
			: defaults.orderType,
		type: (VIEW_TYPES as readonly string[]).includes(rawType ?? "")
			? (rawType as FilterViewDisplay["type"])
			: defaults.type,
	};
}
