/**
 * Postgres identifier quoting + LIKE escaping — single home for these
 * helpers, shared by the multi-dialect builder (`./filter-sql.ts`) and
 * the Postgres-pinned `backend` entry. Zero imports, so the backend
 * closure stays React-free (`./no-ui-imports.test.ts` guards this)
 * and callers can compose identifiers without pulling the builder.
 */

/** Quote a Postgres identifier: `name` → `"name"`, embedded `"` doubled. */
export function quotePgIdent(name: string): string {
	return `"${name.replace(/"/g, '""')}"`;
}

/** `col` → `"col"`; with alias → `"alias"."col"`. */
export function pgColRef(columnName: string, tableAlias?: string): string {
	return tableAlias
		? `${quotePgIdent(tableAlias)}.${quotePgIdent(columnName)}`
		: quotePgIdent(columnName);
}

/** Escape LIKE wildcards so user input matches literally (`\`, `%`, `_`). */
export function escapeLikePattern(value: string): string {
	return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}
