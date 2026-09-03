import { z } from "zod";

import { validateFilterValue } from "./filter-semantics.ts";
import { FILTER_OPERATORS } from "./operators.ts";

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
