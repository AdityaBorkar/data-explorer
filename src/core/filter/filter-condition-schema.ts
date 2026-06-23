import { z } from "zod";

import type { FilterOperator } from "../types";
import { isValidOperatorValue } from "./filter-validation";
import { FILTER_OPERATORS } from "./operators";

export const filterConditionSchema = z
  .object({
    columnId: z.string(),
    combinator: z.enum(["and", "or"]),
    id: z.string(),
    operator: z.enum(FILTER_OPERATORS),
    value: z.unknown(),
  })
  .refine(
    (data: { operator: string; value: unknown }) =>
      isValidOperatorValue(data.operator as FilterOperator, data.value),
    { message: "Invalid value for operator" },
  );
