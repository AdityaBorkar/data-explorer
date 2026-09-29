---
"@adistack/data-explorer": minor
---

Add a Postgres-only server entry: `import { buildFilterWherePg } from "@adistack/data-explorer/backend"`.

`./backend` wraps the existing engine pinned to `dialect: "postgres"` / `placeholderStyle: "numbered"` — `$n` placeholders, `ILIKE … ESCAPE '\'`, `text[] @>`/`&&`, ANSI identifier quoting — with no `react` / `@tanstack/*` / `zod` in its transitive import closure (enforced by `sql/no-ui-imports.test.ts`), so Bun server bundles can import it directly. `dialect` / `placeholderStyle` are absent from the type surface; `caseSensitive` and `tableAlias` remain. Also exports pg identifier helpers (`quotePgIdent`, `pgColRef`, `escapeLikePattern`) and the pure filter surface (predicates, operators, semantics, `groupConditions`, `createSearchFilter`, `DataExplorerError`).

`sql/filter-sql.ts` now imports `quotePgIdent` / `escapeLikePattern` from `sql/pg-identifiers.ts` — a mechanical refactor with byte-identical output (`sql/filter-sql.test.ts` passes unchanged).

The backend sources live under `sql/` (merged layout): the `./backend` entry file is `src/sql/backend.ts`, with `sql/pg-where.ts` and `sql/pg-identifiers.ts` beside it and the import-graph guard at `sql/no-ui-imports.test.ts` — one directory for all filter→SQL code, no `sql ↔ backend` import cycle.

Registry: `data-explorer-sql` ships the backend files and its description mentions the server entry; `data-explorer-core` now also lists `package/src/errors.ts` (gap fix — the root barrel already re-exports it). Backend vendored targets are `components/data-explorer/sql/backend.ts` + `sql/pg-*.ts` (mirror of `package/src/`, so the relative imports resolve).

Also fixed while landing: `lib/dates.ts` now ships in the `filter-bar` and `timeline-view` blocks (their sources import `@/lib/dates`, previously unresolvable in vendored trees), and the `timeline-view` description no longer claims a relative `parseDateValue` import.
