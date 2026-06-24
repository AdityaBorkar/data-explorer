# AGENTS.md

## What this is

A React UI library (`@adityab/data-explorer`) — a **headless** data-explorer core plus **prebuilt** UI components and a filter→SQL helper. **Not a runnable app.** Published as a library; consumers provide peer deps. The headless core (`.`) needs only `react` + `@tanstack/react-query`. The prebuilt `./ui` vendors its own shadcn/Radix primitives in `src/ui/primitives/` and never reaches into consumer `@/` paths.

## Toolchain

- **Bun** for install/scripts only (`bun install`, `bun run <script>`). TypeScript 7 RC, strict, `noEmit`.
- **Biome v2** (real config, not defaults). `useSortedClasses` is an **error** with `fix: "safe"` — it auto-sorts Tailwind classes in `clsx`/`cva`/`tw` and the `classList` attribute. Don't hand-order Tailwind; let `bun run check:lint` do it. Double quotes (incl. JSX), 2-space, width 80, LF. Imports are auto-grouped (`bun:`/`node:` → packages → alias → relative) — don't fight the formatter.

## Commands

- `bun run check:lint` → `biome check --fix .` (auto-fixes in place)
- `bun run check:types` → `tsc --noEmit` — **currently fails**, see "Known WIP"
- `bun run update:deps` → `taze -w && bun install`
- No `dev` script.

## Tests

- Co-located in `src/core/filter/` (`*.test.ts`). Top-level `tests/` and `examples/` dirs are empty.
- **vitest is a devDep** — use `bunx vitest`, NOT `bun test` (tests target vitest, not Bun's runner).
- `bunx vitest` opens **watch mode**; for one-shot use `bunx vitest run`.
- Single file: `bunx vitest src/core/filter/filter-merge.test.ts`.

## Entrypoints & structure

Three subpath exports (the real barrels):

- `.` → `src/core/index.ts` — headless: hooks, filter logic, provider/context, view adapter, types. Depends only on react + react-query (+ nanoid, zod).
- `./sql` → `src/sql/index.ts` — filter → SQL (drizzle-orm). Depends on `.` only.
- `./ui` → `src/ui/index.ts` — prebuilt components. Real dirs: `batch-menu/`, `display-dropdown/`, `filter-input/`, `primitives/`, `views/{board,list,map,timeline,virtual-table}/`. Depends on `.` + `primitives/`. Dependency direction is one-way: `ui → core`, `sql → core`, never reverse.

## TypeScript gotchas

- `verbatimModuleSyntax: true` — type-only imports must use `import type` / `import { type X }`.
- `noUncheckedIndexedAccess: true` — indexing returns `T | undefined`.
- `@/*` → `./src/*` alias exists in tsconfig but is **no longer used** by library sources (former `@/components/ui/*` / `@/lib/utils` were vendored into `src/ui/primitives/`).
- `noUnusedLocals` / `noUnusedParameters` are **off**.

## Dependencies

package.json peer deps (consumers provide): `react`, `react-dom`, `@tanstack/react-query` (required); `@tanstack/react-table`, `@tanstack/react-virtual`, `react-day-picker`, `@hello-pangea/dnd` (optional via `peerDependenciesMeta`).

Regular `dependencies` (auto-installed): `nanoid`, `zod` (core); `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react` (ui primitives). Icon split: **primitives use `lucide-react`** (declared dep); **higher-level ui components use `@tabler/icons-react`** (undeclared — see gap above).

## Verification order

1. `bun run check:lint` (biome, auto-fixes)
2. `bun run check:types` (tsc — **fails today**, see Known WIP)
3. `bunx vitest run` (green; the reliable signal while the ui barrel is broken)
