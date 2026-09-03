import type {
	ColumnConfig,
	FilterCondition,
	FilterViewDisplay,
	ListQueryResult,
	RefineOptions,
	TableFeatures,
} from "@adistack/data-explorer";
import { SEARCH_COLUMN_ID } from "@adistack/data-explorer";
import type { UseQueryOptions } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";

export type TaskStatus = "todo" | "doing" | "done";
export type TaskPriority = "low" | "med" | "high";

export interface Task extends Record<string, unknown> {
	done: boolean;
	due: string;
	estimate: number;
	id: string;
	priority: TaskPriority;
	status: TaskStatus;
	tags: string[];
	title: string;
}

const TITLES = [
	"Design empty states",
	"Fix filter chip overflow",
	"Add board drag handle",
	"Write SQL preview docs",
	"Audit selection keyboard flow",
	"Ship density toggle",
	"Index column metadata",
	"Polish virtualized rows",
	"Add saved view share links",
	"Review pagination cursor",
	"Refine date operator labels",
	"Test 10k row scroll",
];

const TAG_POOL = ["frontend", "backend", "docs", "a11y", "perf", "mobile"];
const STATUSES: TaskStatus[] = ["todo", "doing", "done"];
const PRIORITIES: TaskPriority[] = ["low", "med", "high"];

function pad(n: number): string {
	return n < 10 ? `0${n}` : `${n}`;
}

function makeTask(i: number): Task {
	const title = TITLES[i % TITLES.length] ?? `Task ${i + 1}`;
	const status = STATUSES[i % STATUSES.length] ?? "todo";
	const priority = PRIORITIES[(i * 2 + 1) % PRIORITIES.length] ?? "low";
	const tags = [TAG_POOL[i % TAG_POOL.length] ?? "frontend"];
	const extra = TAG_POOL[(i * 3 + 1) % TAG_POOL.length];
	if (i % 3 === 0 && extra !== undefined && !tags.includes(extra)) {
		tags.push(extra);
	}
	return {
		done: status === "done",
		due: `2026-09-${pad((i % 27) + 1)}`,
		estimate: (i % 8) + 1,
		id: `task-${i + 1}`,
		priority,
		status,
		tags,
		title: `${title} #${Math.floor(i / TITLES.length) + 1}`,
	};
}

/** Deterministic 48-row demo dataset shared by every example. */
export const TASKS: Task[] = Array.from({ length: 48 }, (_, i) => makeTask(i));

/** 500-row variant for the infinite-scroll example. */
export const BIG_TASKS: Task[] = Array.from({ length: 500 }, (_, i) =>
	makeTask(i),
);

/** Column metadata reused for SQL previews and view snapshots. */
export const TASK_COLUMN_CONFIGS: ColumnConfig[] = [
	{ displayName: "Title", id: "title", searchable: true, type: "string" },
	{
		displayName: "Status",
		id: "status",
		options: [
			{ label: "Todo", value: "todo" },
			{ label: "Doing", value: "doing" },
			{ label: "Done", value: "done" },
		],
		searchable: true,
		type: "enum",
	},
	{
		displayName: "Priority",
		id: "priority",
		options: [
			{ label: "Low", value: "low" },
			{ label: "Medium", value: "med" },
			{ label: "High", value: "high" },
		],
		type: "enum",
	},
	{ displayName: "Estimate", id: "estimate", type: "number" },
	{ displayName: "Due", id: "due", type: "date" },
	{
		displayName: "Tags",
		id: "tags",
		options: TAG_POOL.map((t) => ({ label: t, value: t })),
		type: "multiEnum",
	},
	{ displayName: "Done", id: "done", type: "boolean" },
];

/** SQL column mapping for `buildFilterWhere` previews. */
export const TASK_COLUMN_MAPPING: Record<string, string> = {
	done: "done",
	due: "due",
	estimate: "estimate",
	priority: "priority",
	status: "status",
	tags: "tags",
	title: "title",
};

export const TASK_COLUMNS: ColumnDef<TableFeatures, Task>[] = [
	{
		accessorKey: "title",
		header: "Title",
		id: "title",
		meta: { displayName: "Title", searchable: true, type: "string" },
		size: 240,
	},
	{
		accessorKey: "status",
		header: "Status",
		id: "status",
		meta: {
			displayName: "Status",
			options: [
				{ label: "Todo", value: "todo" },
				{ label: "Doing", value: "doing" },
				{ label: "Done", value: "done" },
			],
			searchable: true,
			type: "enum",
		},
		size: 120,
	},
	{
		accessorKey: "priority",
		header: "Priority",
		id: "priority",
		meta: {
			displayName: "Priority",
			options: [
				{ label: "Low", value: "low" },
				{ label: "Medium", value: "med" },
				{ label: "High", value: "high" },
			],
			type: "enum",
		},
		size: 110,
	},
	{
		accessorKey: "estimate",
		header: "Est.",
		id: "estimate",
		meta: { displayName: "Estimate", type: "number" },
		size: 90,
	},
	{
		accessorKey: "due",
		header: "Due",
		id: "due",
		meta: { displayName: "Due", type: "date" },
		size: 120,
	},
	{
		cell: ({ row }) => row.original.tags.join(", "),
		header: "Tags",
		id: "tags",
		meta: {
			displayName: "Tags",
			options: TAG_POOL.map((t) => ({ label: t, value: t })),
			type: "multiEnum",
		},
		size: 160,
	},
	{
		cell: ({ row }) => (row.original.done ? "Yes" : "No"),
		header: "Done",
		id: "done",
		meta: { displayName: "Done", type: "boolean" },
		size: 80,
	},
];

export const DEFAULT_DISPLAY: FilterViewDisplay = {
	columnWidths: {},
	density: "comfortable",
	fields: ["title", "status", "priority", "estimate", "due", "tags", "done"],
	groupBy: null,
	orderBy: "title",
	orderType: "asc",
	type: "table",
};

// ---------------------------------------------------------------------------
// In-memory filtering / sorting / pagination.
// ---------------------------------------------------------------------------

function asString(value: unknown): string {
	return String(value ?? "");
}

function compareValues(a: unknown, b: unknown): number {
	if (typeof a === "number" && typeof b === "number") return a - b;
	const aTime = Date.parse(asString(a));
	const bTime = Date.parse(asString(b));
	if (!Number.isNaN(aTime) && !Number.isNaN(bTime)) return aTime - bTime;
	return asString(a) < asString(b) ? -1 : asString(a) > asString(b) ? 1 : 0;
}

function toStringList(value: unknown): string[] {
	return (Array.isArray(value) ? value : [value]).map((v) => asString(v));
}

function matchesCondition(row: Task, cond: FilterCondition): boolean {
	if (cond.columnId === SEARCH_COLUMN_ID) {
		const term = asString(cond.value).toLowerCase();
		const haystack = [
			row.title,
			row.status,
			row.priority,
			(row.tags as string[]).join(" "),
		]
			.join(" ")
			.toLowerCase();
		return haystack.includes(term);
	}
	const cell: unknown = row[cond.columnId];
	const val = cond.value;
	switch (cond.operator) {
		case "eq":
			return typeof cell === "boolean" || typeof val === "boolean"
				? Boolean(cell) === (val === true || val === "true")
				: asString(cell) === asString(val);
		case "neq":
			return typeof cell === "boolean" || typeof val === "boolean"
				? Boolean(cell) !== (val === true || val === "true")
				: asString(cell) !== asString(val);
		case "contains":
			return asString(cell).toLowerCase().includes(asString(val).toLowerCase());
		case "notContains":
			return !asString(cell)
				.toLowerCase()
				.includes(asString(val).toLowerCase());
		case "startsWith":
			return asString(cell)
				.toLowerCase()
				.startsWith(asString(val).toLowerCase());
		case "endsWith":
			return asString(cell).toLowerCase().endsWith(asString(val).toLowerCase());
		case "isEmpty":
			return (
				cell == null ||
				cell === "" ||
				(Array.isArray(cell) && cell.length === 0)
			);
		case "isNotEmpty":
			return !(
				cell == null ||
				cell === "" ||
				(Array.isArray(cell) && cell.length === 0)
			);
		case "gt":
			return compareValues(cell, val) > 0;
		case "gte":
			return compareValues(cell, val) >= 0;
		case "lt":
			return compareValues(cell, val) < 0;
		case "lte":
			return compareValues(cell, val) <= 0;
		case "between": {
			const [min, max] = toStringList(val);
			return compareValues(cell, min) >= 0 && compareValues(cell, max) <= 0;
		}
		case "notBetween": {
			const [min, max] = toStringList(val);
			return !(compareValues(cell, min) >= 0 && compareValues(cell, max) <= 0);
		}
		case "in":
			return toStringList(val).includes(asString(cell));
		case "notIn":
			return !toStringList(val).includes(asString(cell));
		case "include":
		case "includeAll": {
			const wanted = toStringList(val);
			const have = toStringList(cell);
			return wanted.every((v) => have.includes(v));
		}
		case "includeAny": {
			const wanted = toStringList(val);
			const have = toStringList(cell);
			return wanted.some((v) => have.includes(v));
		}
		case "exclude":
		case "excludeAll": {
			const wanted = toStringList(val);
			const have = toStringList(cell);
			return !wanted.every((v) => have.includes(v));
		}
		case "excludeAny": {
			const wanted = toStringList(val);
			const have = toStringList(cell);
			return !wanted.some((v) => have.includes(v));
		}
	}
}

/**
 * Fold the flat condition list left-to-right honoring each condition's
 * combinator — the same chain the `FilterBar` chips represent.
 */
export function applyFilters(rows: Task[], filters: FilterCondition[]): Task[] {
	if (filters.length === 0) return rows;
	return rows.filter((row) => {
		let acc = true;
		let first = true;
		for (const cond of filters) {
			const hit = matchesCondition(row, cond);
			if (first) {
				acc = hit;
				first = false;
			} else if (cond.combinator === "or") {
				acc = acc || hit;
			} else {
				acc = acc && hit;
			}
		}
		return acc;
	});
}

/**
 * Build the `query` callback the `Provider` expects on top of an in-memory
 * row list: filters + sorts, then paginates with the cursor as an offset.
 */
export function createMemoryQuery(
	source: Task[],
	opts?: { delayMs?: number },
): (refine: RefineOptions) => UseQueryOptions<ListQueryResult<Task>> {
	return (refine: RefineOptions) => ({
		queryFn: async () => {
			if (opts?.delayMs) {
				await new Promise((r) => setTimeout(r, opts.delayMs));
			}
			const filtered = applyFilters(source, refine.filters);
			const sortBy = refine.sorting[0];
			const sortId = sortBy?.id ?? refine.orderBy.columnId;
			const desc =
				sortBy !== undefined
					? (sortBy.desc ?? false)
					: refine.orderBy.direction === "desc";
			const sorted =
				sortId === ""
					? filtered
					: [...filtered].sort((a, b) => {
							const cmp = compareValues(a[sortId], b[sortId]);
							return desc ? -cmp : cmp;
						});
			const offset = Number(refine.cursor ?? "0") || 0;
			const page = sorted.slice(offset, offset + refine.limit);
			const nextOffset = offset + refine.limit;
			return {
				items: page,
				nextCursor: nextOffset < sorted.length ? String(nextOffset) : null,
			};
		},
		queryKey: ["tasks-memory"],
	});
}
