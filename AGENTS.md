# AGENTS.md

## What this is

A React UI library (`@adityab/data-explorer`) — a **headless** data-explorer core plus **prebuilt** UI components and filter/display SQL helpers. **Not a runnable app.** Published as a library; consumers provide all peer deps. The headless core (`.`) is usable with zero UI — just `react` + `@tanstack/react-query`. The prebuilt `./ui` is an optional layer that vendors its own shadcn/Radix primitives internally (in `src/ui/primitives/`); it never reaches into consumer `@/` paths.

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

- `.` → `src/core/index.ts` — **headless**: hooks, filter logic, provider/context (`provider.tsx`, `context.tsx`), view adapter, types. Depends only on react + react-query (+ nanoid, zod).
- `./sql` → `src/sql/index.ts` — filter → SQL translation (drizzle-orm). Depends on `.`.
- `./ui` → `src/ui/index.ts` — **prebuilt** React components (filter-bar, virtual-table, display-dropdown, board/timeline views, batch-menu-bar). Depends on `.` and on `src/ui/primitives/` (vendored shadcn/Radix: popover, command, select, checkbox, input, switch, calendar, button + `cn`). Dependency direction is one-way: `ui → core`, `sql → core`, never reverse.

## TypeScript gotchas

- `verbatimModuleSyntax: true` — type-only imports **must** use `import type` / `import { type X }`.
- `noUncheckedIndexedAccess: true` — indexing returns `T | undefined`.
- Path alias: `@/*` → `./src/*`.
- `noUnusedLocals` / `noUnusedParameters` are **off**.

## Tests

- Tests live co-located in **`src/core/filter/`** (`*.test.ts`). The top-level `tests/` dir is empty — ignore it.
- **vitest is a devDependency** (installed via `bun install`). Use `bunx vitest`, **not** `bun test` (tests are written for vitest's runner, not Bun's).
- Single file: `bunx vitest src/core/filter/filter-merge.test.ts`.

## Peer dependencies (consumers provide)

Required: `react` 18+, `react-dom`, `@tanstack/react-query`. Optional (see `peerDependenciesMeta` — needed only for the matching feature): `@tanstack/react-table` & `@tanstack/react-virtual` (virtual-table), `@hello-pangea/dnd` (board-view), `@tabler/icons-react` (UI icons), `drizzle-orm` (`./sql`), and — for the prebuilt `./ui` primitives — `radix-ui`, `cmdk`, `react-day-picker`. Don't assume a peer dep is always present; a headless-only consumer installs none of the optional ones.

Regular `dependencies` (auto-installed): `nanoid`, `zod` (headless core); `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react` (prebuilt `./ui` primitives).

## Verification order

1. `bun run check:lint` (biome, auto-fixes)
2. `bun run check:types` (tsc)
3. `bunx vitest` (vitest is installed)

Note: `tsconfig.json` `lib` includes `DOM`/`DOM.Iterable` (the prebuilt UI uses DOM APIs). The `@/*` → `./src/*` path alias exists in tsconfig but is **no longer used** by the library sources (all former `@/components/ui/*` / `@/lib/utils` imports were vendored into `src/ui/primitives/`).
