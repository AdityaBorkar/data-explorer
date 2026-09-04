import { nanoid } from "nanoid";

import { DataExplorerError } from "../../errors.ts";
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

/** Matches the ISO strings `serializeFilters` writes for `Date` values. */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

/** Envelope version for serialized filter lists (bump on arity changes). */
export const FILTER_SERIALIZATION_VERSION = 1;

interface VersionedFilterPayload {
	filters: SerializedFilterCondition[];
	v: number;
}

function reviveValue(value: unknown): unknown {
	return typeof value === "string" && ISO_DATE_RE.test(value)
		? new Date(value)
		: value;
}

function toCondition(s: SerializedFilterCondition): FilterCondition {
	if (!OPERATOR_SET.has(s.o)) {
		throw new DataExplorerError(
			"INVALID_FILTER_JSON",
			`Invalid operator "${String(s.o)}" in filter JSON`,
			{ operator: String(s.o) },
		);
	}
	return {
		columnId: s.c,
		combinator: s.b === "or" ? ("or" as const) : ("and" as const),
		id: typeof s.i === "string" && s.i.length > 0 ? s.i : nanoid(),
		operator: s.o as FilterOperator,
		value: reviveValue(s.v),
	};
}

function toSerialized(c: FilterCondition): SerializedFilterCondition {
	return {
		b: c.combinator,
		c: c.columnId,
		i: c.id,
		o: c.operator,
		v: c.value instanceof Date ? c.value.toISOString() : c.value,
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
 * {@link serializeFilters} and legacy bare-array payloads; unknown future
 * versions throw `INVALID_FILTER_JSON` instead of mis-parsing.
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
