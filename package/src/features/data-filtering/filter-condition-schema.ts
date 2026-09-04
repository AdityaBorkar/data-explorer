import { z } from "zod";

import type { ColumnConfig } from "../../columns.ts";
import { validateFilterValue } from "./filter-semantics.ts";
import { FILTER_OPERATORS, getOperatorsForType } from "./operators.ts";

export const filterConditionSchema = z
	.object({
		columnId: z.string(),
		combinator: z.enum(["and", "or"]),
		id: z.string(),
		operator: z.enum(FILTER_OPERATORS),
		value: z.unknown(),
	})
	.refine(
		// Typeless check: column-type-specific rules (e.g. number tuples)
		// are enforced by `validateFilterValue` callers that know the type.
		(data) => validateFilterValue(data.operator, data.value) === undefined,
		{
			message: "Invalid value for operator",
		},
	);

/**
 * Column-aware condition schema: additionally checks `columnId ∈ config`
 * and `operator ∈ operators[type]` (including per-column `operators`
 * overrides) so form-level zod errors match the server-side
 * `validateConditions` errors from the SQL builder.
 *
 * @example
 * ```ts
 * const schema = makeFilterConditionSchema(columnsConfig);
 * schema.parse({ columnId: "estimate", combinator: "and", id: "a", operator: "between", value: [1, 5] });
 * ```
 */
export function makeFilterConditionSchema(columnsConfig: ColumnConfig[]) {
	const byId = new Map(columnsConfig.map((c) => [c.id, c]));
	return z
		.object({
			columnId: z.string().refine((id) => byId.has(id) || id === "_search", {
				message: "Unknown column",
			}),
			combinator: z.enum(["and", "or"]),
			id: z.string(),
			operator: z.enum(FILTER_OPERATORS),
			value: z.unknown(),
		})
		.superRefine((data, ctx) => {
			if (data.columnId === "_search") {
				if (data.operator !== "contains") {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: 'Invalid operator for search (must be "contains")',
					});
				}
				return;
			}
			const col = byId.get(data.columnId);
			if (!col) return; // already reported on columnId
			const valid = col.operators ?? getOperatorsForType(col.type);
			if (!valid.includes(data.operator)) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: `Invalid operator "${data.operator}" for column "${data.columnId}"`,
				});
				return;
			}
			const error = validateFilterValue(data.operator, data.value, col.type);
			if (error) {
				ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
			}
		});
}
