import { nanoid } from "nanoid";

import { DataExplorerError } from "../../errors.ts";
import type {
	FilterCondition,
	FilterOperator,
	SerializedFilterCondition,
} from "../../filters.ts";
import { normalizeOperator } from "./operators.ts";

/** Matches the ISO strings legacy v1 payloads wrote for `Date` values. */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

/** Tagged-Date key: v2 payloads encode `Date` as `{ __date: iso }`. */
const DATE_TAG = "__date";

/** Envelope version for serialized filter lists (bump on arity changes). */
export const FILTER_SERIALIZATION_VERSION = 2;

interface VersionedFilterPayload {
	filters: SerializedFilterCondition[];
	v: number;
}

function isTaggedDate(value: unknown): value is Record<string, unknown> {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return false;
	}
	const entries = Object.entries(value as Record<string, unknown>);
	return (
		entries.length === 1 &&
		entries[0]?.[0] === DATE_TAG &&
		typeof entries[0]?.[1] === "string" &&
		ISO_DATE_RE.test(entries[0][1] as string)
	);
}

/**
 * Value walkers. `serializeValue` tags `Date` leaves as `{ __date: iso }`
 * so ISO-like strings stay strings on revive; `reviveTagged` decodes only
 * tagged dates (v2), while `reviveLegacy` keeps the v1 behavior of reviving
 * bare ISO strings for backwards compatibility.
 */
function serializeValue(value: unknown): unknown {
	if (value instanceof Date) return { [DATE_TAG]: value.toISOString() };
	if (Array.isArray(value)) return value.map(serializeValue);
	if (typeof value === "object" && value !== null) {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>).map(([k, v]) => [
				k,
				serializeValue(v),
			]),
		);
	}
	return value;
}

function reviveTagged(value: unknown): unknown {
	if (isTaggedDate(value)) {
		return new Date((value as Record<string, string>)[DATE_TAG] as string);
	}
	if (Array.isArray(value)) return value.map(reviveTagged);
	if (typeof value === "object" && value !== null) {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>).map(([k, v]) => [
				k,
				reviveTagged(v),
			]),
		);
	}
	return value;
}

function reviveLegacy(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(reviveLegacy);
	if (typeof value === "object" && value !== null) {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>).map(([k, v]) => [
				k,
				reviveLegacy(v),
			]),
		);
	}
	if (typeof value === "string" && ISO_DATE_RE.test(value)) {
		return new Date(value);
	}
	return value;
}

function toCondition(
	s: SerializedFilterCondition,
	revive: (value: unknown) => unknown,
): FilterCondition {
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
		value: revive(s.v),
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
 * (`{ v: 2, filters: […] }`). `Date` values become `{ __date: iso }`
 * tags and are revived by {@link deserializeFilters}, keeping
 * `stableStringify` round-trip stable without converting ISO-like strings.
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
 * {@link serializeFilters} (v2 tagged dates, v1 bare ISO strings) and
 * legacy bare-array payloads (including the historical `include` /
 * `exclude` operator names, normalized to `includeAll` / `excludeAll`);
 * unknown future versions throw `INVALID_FILTER_JSON` instead of
 * mis-parsing.
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
		return (parsed as SerializedFilterCondition[]).map((s) =>
			toCondition(s, reviveLegacy),
		);
	}
	if (typeof parsed === "object" && parsed !== null && "filters" in parsed) {
		const payload = parsed as VersionedFilterPayload;
		if (payload.v !== 1 && payload.v !== FILTER_SERIALIZATION_VERSION) {
			throw new DataExplorerError(
				"INVALID_FILTER_JSON",
				`Unsupported filter payload version "${String(payload.v)}"`,
				{ version: payload.v },
			);
		}
		if (!Array.isArray(payload.filters)) {
			throw new DataExplorerError("INVALID_FILTER_JSON", "Invalid filter JSON");
		}
		const revive =
			payload.v === FILTER_SERIALIZATION_VERSION ? reviveTagged : reviveLegacy;
		return payload.filters.map((s) => toCondition(s, revive));
	}
	throw new DataExplorerError("INVALID_FILTER_JSON", "Invalid filter JSON");
}
