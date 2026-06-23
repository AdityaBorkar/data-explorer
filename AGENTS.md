# AGENTS.md

## What this is

A React UI library (`@adityab/data-explorer`) — data-explorer components plus filter/display SQL helpers. **Not a runnable app.** Published as a library; consumers provide all peer deps. The `package.json` `"module": "index.ts"` and exports `"."` → `./src/index.ts` are stale — `src/index.ts` does not exist.

## Toolchain

- **Bun** for install/scripts only (`bun install`, `bun run <script>`). TypeScript 7 RC, strict, `noEmit: true`.
- **Biome v2** with a real config (`biome.jsonc`) — not defaults. Notable rules:
  - `useSortedClasses` is an **error** (auto-sorts Tailwind classes via `clsx`/`cva`/`tw` and the `classList` attribute). Don't hand-order Tailwind classes; let the fixer do it.
  - Double quotes (incl. JSX), 2-space indent, width 80, LF.
  - Imports auto-organized into groups (`bun:`/`node:` first, then packages, aliases, relative paths) — don't fight the formatter.

## Commands

- `bun run check:lint` → `biome check --fix .` (note: **auto-fixes** in place)
- `bun run check:types` → `tsc --noEmit`
- `bun run dev` → empty/stale, ignore.

## Entrypoints & structure

Three subpath exports (the real barrel entrypoints):

- `.` → `src/core/index.ts` — hooks, filter logic, provider/context (`provider.tsx`, `context.tsx`), view adapter, types
- `./sql` → `src/sql/index.ts` — filter → SQL translation (drizzle-orm)
- `./ui` → `src/ui/index.ts` — React components (filter-bar, virtual-table, display-dropdown, board/timeline views, batch-menu-bar)

## TypeScript gotchas

- `verbatimModuleSyntax: true` — type-only imports **must** use `import type` / `import { type X }`.
- `noUncheckedIndexedAccess: true` — indexing returns `T | undefined`.
- Path alias: `@/*` → `./src/*`.
- `noUnusedLocals` / `noUnusedParameters` are **off**.

## Tests

- Tests live in **`src/__tests__/`** (the top-level `tests/` dir is empty — ignore it).
- Tests import from **`vitest`**, which is not yet in `package.json` deps, so they don't run until installed. Use `bunx vitest`, **not** `bun test` (tests aren't written for Bun's runner).
- Single file: `bunx vitest src/__tests__/filter-merge.test.ts`.

## Peer dependencies (consumers provide)

React 18+, react-dom, `@tanstack/react-query`, `@tanstack/react-table`, `@tanstack/react-virtual`, `drizzle-orm`, `@hello-pangea/dnd`, `@tabler/icons-react`. Some are optional (see `peerDependenciesMeta`) — don't assume a peer dep is always present.

## Verification order

1. `bun run check:lint` (biome, auto-fixes)
2. `bun run check:types` (tsc)
3. `bunx vitest` (once vitest is installed)
