// Thin compatibility adapter over `./filter-semantics.ts`.
// New code should import from `./filter-semantics.ts` directly: it is the
// single module that owns operator/value policy. The deprecated
// `isSetOperator`/`isArrayOperator` aliases are removed; use
// `requiresArrayValue` instead.

export type { CoercedFilterValue } from "./filter-semantics.ts";
export {
	coerceFilterValue,
	isNullaryOperator,
	isRangeOperator,
	isValidOperatorValue,
	requiresArrayValue,
	requiresValue,
	validateFilterValue,
	validateOperatorValue,
} from "./filter-semantics.ts";
