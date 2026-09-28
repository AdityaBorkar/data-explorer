import { nanoid } from "nanoid";

import { DataExplorerError } from "../../errors.ts";
import type {
	FilterCondition,
	FilterOperator,
	SerializedFilterCondition,
} from "../../filters.ts";
import { normalizeOperator } from "./operators.ts";

/** Matches the ISO strings `serializeFilters` writes for `Date` values. */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

/** Envelope version for serialized filter lists (bump on arity changes). */
export const FILTER_SERIALIZATION_VERSION = 1;

interface VersionedFilterPayload {
	filters: SerializedFilterCondition[];
	v: number;
}

/**
 * Single recursive walker for filter values. `serializeValue` encodes
 * `Date` leaves to ISO strings; `reviveValue` decodes matching strings
 * back — one traversal shape instead of two mirrored recursions.
 */
function mapFilterValue(
	value: unknown,
	leaf: (v: unknown) => unknown,
): unknown {
	if (Array.isArray(value)) return value.map((v) => mapFilterValue(v, leaf));
	if (typeof value === "object" && value !== null && !(value instanceof Date)) {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>).map(([k, v]) => [
				k,
				mapFilterValue(v, leaf),
			]),
		);
	}
	return leaf(value);
}

function reviveValue(value: unknown): unknown {
	return mapFilterValue(value, (v) =>
		typeof v === "string" && ISO_DATE_RE.test(v) ? new Date(v) : v,
	);
}

function serializeValue(value: unknown): unknown {
	return mapFilterValue(value, (v) =>
		v instanceof Date ? v.toISOString() : v,
	);
}

function toCondition(s: SerializedFilterCondition): FilterCondition {
	if (typeof s.c !== "string" || s.c.length === 0) {
		throw new DataExplorerError(
			"INVALID_FILTER_JSON",
			`Invalid column "${String(s.c)}" in filter JSON`,
			{ columnId: String(s.c) },
		);
	}
	const operator: FilterOperator | undefined =
		typeof s.o === "string" ? normalizeOperator(s.o) : undefined;
	if (!operator) {
		throw new DataExplorerError(
			"INVALID_FILTER_JSON",
			`Invalid operator "${String(s.o)}" in filter JSON`,
			{ operator: String(s.o) },
		);
	}
	if (s.b !== "and" && s.b !== "or") {
		throw new DataExplorerError(
			"INVALID_FILTER_JSON",
			`Invalid combinator "${String(s.b)}" in filter JSON`,
			{ combinator: String(s.b) },
		);
	}
	return {
		columnId: s.c,
		combinator: s.b,
		id: typeof s.i === "string" && s.i.length > 0 ? s.i : nanoid(),
		operator,
		value: reviveValue(s.v),
	};
}

function toSerialized(c: FilterCondition): SerializedFilterCondition {
	return {
		b: c.combinator,
		c: c.columnId,
		i: c.id,
		o: c.operator,
		v: serializeValue(c.value),
	};
}

/**
 * Serialize filter conditions to a versioned JSON envelope
 * (`{ v: 1, filters: […] }`). `Date` values become ISO strings and are
 * revived by {@link deserializeFilters}, keeping `stableStringify`
 * round-trip stable.
 */
export function serializeFilters(conditions: FilterCondition[]): string {
	const payload: VersionedFilterPayload = {
		filters: conditions.map(toSerialized),
		v: FILTER_SERIALIZATION_VERSION,
	};
	return JSON.stringify(payload);
}

/**
 * Deserialize filter lists. Accepts the versioned envelope from
 * {@link serializeFilters} and legacy bare-array payloads (including the
 * historical `include` / `exclude` operator names, normalized to
 * `includeAll` / `excludeAll`); unknown future versions throw
 * `INVALID_FILTER_JSON` instead of mis-parsing.
 */
export function deserializeFilters(json: string): FilterCondition[] {
	if (!json) return [];
	let parsed: unknown;
	try {
		parsed = JSON.parse(json) as unknown;
	} catch {
		throw new DataExplorerError("INVALID_FILTER_JSON", "Invalid filter JSON");
	}
	if (Array.isArray(parsed)) {
		return (parsed as SerializedFilterCondition[]).map(toCondition);
	}
	if (typeof parsed === "object" && parsed !== null && "filters" in parsed) {
		const payload = parsed as VersionedFilterPayload;
		if (payload.v !== FILTER_SERIALIZATION_VERSION) {
			throw new DataExplorerError(
				"INVALID_FILTER_JSON",
				`Unsupported filter payload version "${String(payload.v)}"`,
				{ version: payload.v },
			);
		}
		if (!Array.isArray(payload.filters)) {
			throw new DataExplorerError("INVALID_FILTER_JSON", "Invalid filter JSON");
		}
		return payload.filters.map(toCondition);
	}
	throw new DataExplorerError("INVALID_FILTER_JSON", "Invalid filter JSON");
}
