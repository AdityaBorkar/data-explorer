/**
 * Matchable error taxonomy for `@adistack/data-explorer`.
 *
 * Every throw in the headless core uses {@link DataExplorerError} (or a
 * subclass) with a stable {@link DataExplorerErrorCode} so consumers can
 * branch on `error.code` instead of regex-matching `error.message`.
 * Plain `Error` and `console.*` are never used from library code.
 *
 * @example
 * ```ts
 * import { DataExplorerError, buildFilterWhere } from "@adistack/data-explorer";
 *
 * try {
 *   buildFilterWhere(filters, columns, mapping);
 * } catch (error) {
 *   if (error instanceof DataExplorerError && error.code === "UNKNOWN_COLUMN") {
 *     highlightChip(error.details?.["columnId"] as string);
 *   }
 * }
 * ```
 */

/** Stable codes for every failure the headless core can raise. */
export type DataExplorerErrorCode =
	| "MISSING_QUERY_CLIENT"
	| "INVALID_QUERY_OPTIONS"
	| "UNKNOWN_COLUMN"
	| "MISSING_MAPPING"
	| "INVALID_OPERATOR"
	| "INVALID_FILTER_VALUE"
	| "INVALID_FILTER_JSON"
	| "EMPTY_GROUP"
	| "NO_SEARCHABLE_COLUMN"
	| "UNSUPPORTED_DIALECT"
	| "INVALID_COLUMN_DEF"
	| "UNKNOWN_VIEW"
	| "VIEWS_NOT_CONFIGURED"
	| "MISSING_PROVIDER";

/** Base error for the data-explorer core. Branch on {@link code}. */
export class DataExplorerError extends Error {
	/** Stable machine-readable failure code. */
	readonly code: DataExplorerErrorCode;
	/** Structured context (e.g. `{ columnId }`) for UI highlighting. */
	readonly details?: Record<string, unknown>;

	constructor(
		code: DataExplorerErrorCode,
		message: string,
		details?: Record<string, unknown>,
	) {
		super(message);
		this.name = "DataExplorerError";
		this.code = code;
		if (details !== undefined) this.details = details;
	}
}

/**
 * SQL-builder failures from `buildFilterWhere`.
 * Carries the offending `columnId` in {@link DataExplorerError.details}
 * so callers can highlight the failing filter chip.
 */
export class FilterSqlError extends DataExplorerError {
	constructor(
		code: DataExplorerErrorCode,
		message: string,
		details?: Record<string, unknown>,
	) {
		super(code, message, details);
		this.name = "FilterSqlError";
	}
}

/**
 * Thrown when a context hook runs outside `<Provider>`.
 * Includes the hook name so copy-pasted `useSelectionContext` failures
 * point at the right call site.
 */
export class MissingProviderError extends DataExplorerError {
	constructor(hookName = "useDataExplorerContext") {
		super(
			"MISSING_PROVIDER",
			`${hookName} must be used within <Provider> (did you forget DataExplorerProvider / QueryClientProvider?).`,
			{ hookName },
		);
		this.name = "MissingProviderError";
	}
}
