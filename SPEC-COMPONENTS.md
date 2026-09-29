# SPEC-COMPONENTS — `FilterSentence`: shadcn registry block from recruiter-mg iteration-6

Date: 2026-09-29 · Status: draft · Source:
`recruiter-mg/src/components/dev/filter-iterations/iteration-6.tsx` (+ `shared.tsx`)
· Target: this repo's shadcn registry (`registry.json`, authoring in
`components/src/`)

> Naming note: the request said "@aspen-os/data-explorer". There is no
> data-explorer package under `~/projects/aspen-os` — the ship target is this
> repo (`@adistack/data-explorer` + the `data-explorer` shadcn registry), which
> is where all data-explorer UI blocks live. Aspen OS stays headless-only.

## 0. TL;DR

- Port **iteration 6** — the guided sentence ↔ builder morph — into this repo as
  a new registry block **`data-explorer-filter-sentence`** under
  `components/src/filter-sentence/`, headless-wired to `useDataExplorerContext`
  (like `FilterBar`), **not** driven by the demo's `FILTER_JSON`.
- The demo's display-string operators (`"is"`, `"is not"`, `"is before"`) map to
  the canonical `FilterOperator` catalog (`getOperatorsForType` /
  `getOperatorLabel` / `getDefaultOperator`); the first row's UI-only `Where`
  maps to `combinator: "and"` with a rendered label.
- **Edit/Save morph semantics map cleanly onto the headless table API**: Edit
  snapshots `table.state.dataFilters` into a local draft; Save validates the
  draft (`validateCondition`), coerces values (`coerceFilterValue`), and commits
  in one call via `table.setDataFilters(draft)`.
- Reuse, don't re-port: `OperatorSelector` + `ValueInput` (from the
  `data-explorer-filter-bar` block, relative-imported like `gantt.tsx` does) and
  `formatFilterValue` from the core replace the demo's hand-rolled selects and
  `<Term>` value rendering.
- **Scope cuts**: the demo's search input, `SortControl`, `ViewPopover` and
  `ViewPreview` are not part of this block (display concerns already live in
  `data-explorer-display`); the "Filter view name" input becomes an app-shell
  concern via `useView().createView(name)`.
- `motion` is a new dependency for this block (first motion user in the
  registry); reduced-motion degrades to `duration: 0`.

## 1. Background — what iteration 6 is

`iteration-6.tsx` (route `/dev/filter-iterations` in recruiter-mg) combines two
earlier iterations into one card driven by a single `FILTER_JSON` object:

1. **Sentence mode** — the saved formula rendered as prose with muted
   `<Term>` chips: *"Employees whose <status> <is> <Active> and <department>
   <is> <Engineering>"*. An `Edit` button (`PenLine`) sits at the card corner.
2. **Builder mode** — clicking Edit morphs the card in place (motion `layout`,
   `AnimatePresence mode="popLayout"`, shared-element `layoutId` gliding the
   action button from the sentence corner to the toolbar, flipping its icon
   `PenLine`→`Save`): a "Filter view name" input, one row per condition
   (`Where/And/Or` toggle · field select · operator select · value input ·
   remove), an "Add condition" dashed button, and a `Save` button that morphs
   the card back with the edited formula re-rendered as the sentence.

Everything is UI-only: `FILTER_JSON.fields` carries per-field operator lists as
display strings, `FILTER_JSON.seed` is the saved formula, `shared.tsx` provides
mock view controls (`useViewConfig`, `SortControl`, `ViewPopover`,
`ViewPreview`) that filter nothing.

`DATA_EXPLORER_REPORT.md` §1.1 already enumerated the gaps this port closes:
display-string operators → canonical ops, index-based ids → stable ids, raw
string values → validated/coerced values, `Where` → `and`, and controls driven
by table state instead of local `useViewConfig` state.

## 2. Contract mapping (demo → headless)

| Iteration 6 today | `FilterSentence` block |
|---|---|
| `FILTER_JSON.fields: {label, value, operators: string[]}` | `columnsConfig: ColumnConfig[]` from context (`{id, displayName, type, operators?, options?}`); row operator lists = `column.operators ?? getOperatorsForType(column.type)` |
| `FILTER_JSON.seed: {connector: Where/And/Or, field, operator, value}` | `table.state.dataFilters: FilterCondition[]` (`{id, columnId, operator: FilterOperator, value: unknown, combinator: "and" \| "or"}`) |
| `Where` label on first row (non-toggling) | stored `combinator: "and"`; first row renders `Where` + disabled toggle, rows ≥ 2 toggle `and`/`or` and render lowercase in prose |
| Display-string operators | `FilterOperator` keys; UI labels via `getOperatorLabel` (`eq` → "is", `neq` → "is not", `lt` → "is before", `gt` → "is after", …) |
| Default operator on field switch = first in list | `getDefaultOperator(column.type)` when the current operator isn't valid for the new column (mirrors the demo's `fieldFor` fallback) |
| Stable numeric `id` per row | `createFilter()` nanoid ids; ids are preserved through the draft so `AnimatePresence` keys and reordering stay stable |
| Raw `Input` for every value | `ValueInput` from `filter-input/` (prop-driven: `{column, operator, value, onChange, onCommit}`) — renders text/number/enum-select/date/boolean-switch per `editorKind`, and returns `null` for nullary ops (`isEmpty`/`isNotEmpty`) |
| Hand-rolled operator select | `OperatorSelector` from `filter-input/` (Command list, respects `column.operators` override) |
| Empty value renders "any value" | sentence view renders italic "any value"; but **Save is disabled while any draft row fails `validateCondition`** — blank values don't commit in the headless world (deliberate divergence from the demo, which allowed committing blanks) |
| "Employees" subject literal | `subject?: string` prop (default `"records"`) — app-owned vocabulary |
| `Filter view name` input | cut from the block; the example wires a "Save as view" affordance through `useView().createView(name)` in the app shell (§6) |
| Search input, `SortControl`, `ViewPopover`, `ViewPreview` | cut; covered by `SEARCH_COLUMN_ID` search in `FilterBar` and the `data-explorer-display` block |
| Lucide icons | `@tabler/icons-react` (registry convention): `IconPencil`, `IconDeviceFloppy`, `IconPlus`, `IconX` |

## 3. Component design

### 3.1 Files

```
components/src/filter-sentence/
├── filter-sentence.tsx   # FilterSentence — orchestrator, morph, draft state, action button
├── sentence-view.tsx     # SentenceView — prose rendering of FilterCondition[]
└── builder-row.tsx       # SentenceBuilderRow — combinator toggle + selects + value + remove
```

Barrel additions in `components/src/index.ts`:

```ts
export { FilterSentence } from "./filter-sentence/filter-sentence.tsx";
export { SentenceView } from "./filter-sentence/sentence-view.tsx";
```

### 3.2 `FilterSentence`

```ts
import type { ColumnConfig, FilterCondition } from "@adistack/data-explorer";
import {
	coerceFilterValue,
	createFilter,
	getDefaultOperator,
	getOperatorLabel,
	getOperatorsForType,
	validateCondition,
} from "@adistack/data-explorer";
import { useDataExplorerContext } from "@adistack/data-explorer";

interface FilterSentenceProps {
	className?: string;
	/** Prose subject, e.g. "Employees". Default "records". */
	subject?: string;
}
```

- **State source**: `const { columnsConfig, table } = useDataExplorerContext()`
  — same contract as `FilterBar`; requires a `DataExplorer Provider` ancestor
  (which itself requires `QueryClientProvider`).
- **Mode state**: `const [advanced, setAdvanced] = useState(false)` (sentence ↔
  builder), exactly like the demo.
- **Draft model** (the key divergence from `FilterBar`, which commits per
  keystroke): entering Edit snapshots the committed filters —

  ```ts
  const [draft, setDraft] = useState<FilterCondition[]>([]);
  const openBuilder = () =>
  	setDraft(table.state.dataFilters.map((condition) => ({ ...condition })));
  ```

  All row edits (patch field/operator/value, toggle combinator, remove, add)
  mutate `draft` only. **Save commits atomically**:

  ```ts
  const columnsById = new Map(columnsConfig.map((c) => [c.id, c]));
  const rowError = (condition: FilterCondition) =>
  	validateCondition(condition, columnsById); // ConditionValidationError | undefined

  const save = () => {
  	// every row must validate; blank values are blocked here, not coerced away
  	table.setDataFilters(draft); // Updater accepts a plain value
  	setAdvanced(false);
  };
  ```

  `canSave = draft.every((c) => rowError(c) === undefined)` gates the Save
  button; failing rows get a destructive ring + `title={rowError.message}`
  (branch on `code`, never on message text). Discarding is implicit — leaving
  without Save never touches `table.state` (matches the demo, where Save is the
  only exit; an explicit Esc-to-discard is a possible follow-up, not in scope).

- **Add condition**:

  ```ts
  const addCondition = () => {
  	const column = columnsConfig[0];
  	if (!column) return;
  	setDraft((prev) => [
  		...prev,
  		{ ...createFilter(column.id, getDefaultOperator(column.type), ""),
  		  combinator: "and" },
  	]);
  };
  ```

  (`createFilter` seeds a nanoid `id` and `combinator: "and"`; the spread only
  documents intent.)

- **Field switch** (per row): keep the operator when
  `(column.operators ?? getOperatorsForType(column.type)).includes(operator)`,
  otherwise fall back to `getDefaultOperator(column.type)` — ports the demo's
  `fieldFor` logic without the display-string juggling.
- **Operator switch**: coerce the value in the same breath as `FilterChip`
  does — `const { value } = coerceFilterValue(next, condition.value); patch({ operator: next, value })`
  — so nullary ops collapse to `null` and `ValueInput`'s `editorKind` re-render
  stays consistent.
- **Empty state** (sentence mode, zero conditions): keep the demo's italic
  "No conditions yet — pick Edit to add one."

### 3.3 `SentenceView`

Pure function of `{conditions, columnsConfig, subject}`. Rendering rules:

- `<p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm …">`
  opening with `<span>{subject}</span>`, then per condition:
  word = index 0 ? `"whose"` : `condition.combinator` (already lowercase).
- Three `<Term>`-style chips per condition, styled like the demo
  (`rounded bg-muted/80 px-1.5 py-0.5 font-medium text-foreground`):
  1. `column.displayName` (lookup from `columnsConfig`; unknown column →
     render the raw `columnId` in a `text-muted-foreground` chip rather than
     crashing — stale saved views must not throw).
  2. `getOperatorLabel(condition.operator)`.
  3. Value: `formatFilterValue(condition.value, condition.operator, column)`
     — the same call shape `filter-chip.tsx` uses (handles enum
     `options` label mapping, dates, arrays). When it returns `null` (blank /
     nullary), render the italic `any value` placeholder for valued operators;
     nullary operators render nothing after the operator label.
- Unknown-column and stale conditions are rendered, never filtered — the
  sentence is a faithful view of `table.state.dataFilters`.

`SentenceView` is exported on its own so apps can render the prose without the
morph (e.g. inside a saved-views list).

### 3.4 `SentenceBuilderRow`

Props: `{condition, column, index, onPatch(id, patch), onRemove(id)}`.

- **Combinator**: first row (`index === 0`) renders a muted, non-interactive
  `Where` label (`title="First condition"`); later rows render a button that
  toggles `and`/`or` (`title="Toggle And / Or"`, `text-primary hover:underline`
  when not `and`). Local to this block — `FilterCombinatorToggle` renders the
  uppercase chip-bar style and belongs to the filter-bar block; do not
  cross-import it.
- **Field select / operator select**: shadcn `Select` triggers styled as in the
  demo (`h-7 w-36 rounded-md text-xs`), items derived from `columnsConfig` and
  `column.operators ?? getOperatorsForType(column.type)`, labels from
  `displayName` / `getOperatorLabel`. Keep `aria-label="Filter column"` /
  `"Filter operator"` (renamed from the demo's "Condition …").
- **Value**: `<ValueInput column operator value onChange onCommit/>` reused via
  a **relative import** into the vendored filter-bar files:

  ```ts
  import { OperatorSelector } from "../filter-input/operator-selector.tsx";
  import { ValueInput } from "../filter-input/value-input.tsx";
  ```

  This is the established pattern (`views/gantt.tsx` relative-imports
  `parseDateValue` from `filter-input/`, and `data-explorer-timeline-view`
  declares `registryDependencies: ["data-explorer-filter-bar"]` to guarantee
  those files exist in the consumer). The relative import must be preserved
  verbatim — the registry installer keeps it, same as the gantt precedent.
  Note in the item description that `data-explorer-filter-bar` is required.
- **Remove**: `IconX` button, `aria-label="Remove condition"`.
- **Invalid rows**: `aria-invalid` + destructive ring when
  `validateCondition` fails for the row (the orchestrator passes the error
  down or the row recomputes it — pass it down from `FilterSentence` so the
  columns map is built once).

## 4. Motion plan

Iteration 6 is the first registry block with motion. Decisions:

- **Dependency**: `motion` (the `motion/react` entry points used by the demo:
  `m`, `AnimatePresence`, `useReducedMotion`). Add `motion` to
  `components/package.json` `dependencies` (for workspace typecheck) **and** to
  the registry item's `dependencies` (for consumers).
- **Spring tokens**: the demo imports `SPRING_LAYOUT` from recruiter-mg's
  `#/components/beui/ease`. The block defines its own local constant so the
  registry stays self-contained:

  ```ts
  /** Shared-layout glide — mirrors recruiter-mg `beui/ease` SPRING_LAYOUT. */
  const SPRING_LAYOUT = {
  	damping: 32,
  	mass: 0.6,
  	stiffness: 360,
  	type: "spring",
  } as const;
  ```

  If a second block later needs springs, promote to `components/src/lib/motion.ts`
  — not now (single user).
- **Reduced motion**: `const reduce = useReducedMotion(); const motionSafe =
  reduce ? { duration: 0 } : SPRING_LAYOUT;` — every `transition` prop uses
  `motionSafe`. Port the demo's three animation bundles verbatim: the card
  `m.div layout`, the `panelMotion` enter/exit (`y: ±12`, `scale: 0.98`), and
  `rowMotion` (`x: ±16`, exit `duration: 0.15`).
- **Shared-element action button**: the demo's `MotionButton` is recruiter-mg
  UI. Here, wrap the shadcn `Button`:

  ```tsx
  const MotionButton = m.create(Button);
  // …
  <MotionButton layoutId="filter-sentence-action" size="sm" variant="outline" …>
  ```

  Keep the `layoutId` stable across modes (that is what glides the button
  between the sentence corner and the toolbar while `PenLine`↔`Save` swap).
- **`AnimatePresence initial={false} mode="popLayout"`** around the two panel
  variants and a nested `AnimatePresence initial={false}` around the row list —
  same structure as the demo.
- SSR is a non-issue: `m` components are client-safe under `"use client"`-style
  RSC boundaries; consumer apps using TanStack Start/Next render this block
  client-side like the rest of the registry.

## 5. Registry contract

### 5.1 New item in `registry.json`

Insert after `data-explorer-filter-bar` (and mirror its shape):

```json
{
	"$schema": "https://ui.shadcn.com/schema/registry-item.json",
	"dependencies": ["@adistack/data-explorer", "@tabler/icons-react", "motion"],
	"description": "FilterSentence: saved filters rendered as a plain-language sentence that morphs in place into a Where/And/Or builder (Edit ↔ Save shared-element morph, motion). Reads/writes dataFilters via the DataExplorer context; Save validates every row (validateCondition) and commits atomically. Reuses OperatorSelector/ValueInput from the filter-bar block via preserved relative imports — requires data-explorer-filter-bar and a DataExplorer Provider ancestor.",
	"files": [
		{
			"path": "components/src/filter-sentence/filter-sentence.tsx",
			"target": "components/data-explorer/ui/filter-sentence/filter-sentence.tsx",
			"type": "registry:component"
		},
		{
			"path": "components/src/filter-sentence/sentence-view.tsx",
			"target": "components/data-explorer/ui/filter-sentence/sentence-view.tsx",
			"type": "registry:component"
		},
		{
			"path": "components/src/filter-sentence/builder-row.tsx",
			"target": "components/data-explorer/ui/filter-sentence/builder-row.tsx",
			"type": "registry:component"
		}
	],
	"name": "data-explorer-filter-sentence",
	"registryDependencies": [
		"button",
		"command",
		"input",
		"popover",
		"select",
		"data-explorer-filter-bar",
		"utils"
	],
	"title": "Data Explorer Filter Sentence",
	"type": "registry:block"
}
```

(`command` is needed because `OperatorSelector` imports `@/components/ui/command`;
`popover` because `ValueInput`'s enum/multi/date editors are popover-based.)

### 5.2 Aggregator

Add `"data-explorer-filter-sentence"` to the `data-explorer` aggregator item's
`registryDependencies` (after `data-explorer-filter-bar`). The barrel export
already flows through `components/src/index.ts` → aggregator's
`ui/index.ts` target.

### 5.3 Consumer install

```
bunx shadcn add <registry-url>/data-explorer-filter-sentence
```

lands the three files at `components/data-explorer/ui/filter-sentence/` plus
the filter-bar files, primitives, and `npm i motion @adistack/data-explorer`.

## 6. Example (this repo)

`examples/src/examples/filter-sentence.tsx`, registered in
`examples/src/examples/index.ts` (`slug: "filter-sentence"`, files:
`examples/filter-sentence.tsx`, `components/explorer-shell.tsx`, `lib/tasks.ts`):

- Reuse `explorer-shell.tsx`'s canonical `Provider` wiring (it already has
  `QueryClientProvider` + column metas).
- Render `<FilterSentence subject="Tasks"/>` above the existing `FilterBar` in
  one shell so both editors stay in sync through `table.state.dataFilters` —
  the demo proves the draft commit: edit in the sentence builder, Save, watch
  the chips update (and vice versa).
- Add the "Save as view" affordance **in the example, not the block**: a small
  input + button calling `useView({...}).createView(name)` from the saved-views
  example pattern. Views are an app-shell concern (`useView` needs a
  `ViewAdapter`); the block stays filter-only.

## 7. Consumer wiring (recruiter-mg)

- After the registry item ships, vendor it into recruiter-mg the usual way —
  installed files land at `src/components/data-explorer/ui/filter-sentence/`;
  add the two exports to `src/components/data-explorer/ui/index.ts`.
- recruiter-mg already ships `motion` (its beui primitives depend on it), so
  the vendored copy needs no new dependency there.
- Usage sits inside the existing `Provider` on `/dev/data-explorer`:

  ```tsx
  <FilterSentence subject="Employees" />
  ```

- `iteration-6.tsx` and `shared.tsx` stay untouched in
  `src/components/dev/filter-iterations/` — they remain the design reference
  for the iteration gallery; the registry block is the production descendant,
  not a replacement of the demo file.

## 8. Non-goals

- **Search input** — `SEARCH_COLUMN_ID` (`_search`) already pins `contains`;
  global search belongs to `FilterBar`.
- **Sort / display columns / view-type popover** — the demo's `SortControl`,
  `ViewPopover`, `ViewPreview` map onto `data-explorer-display` +
  `data-explorer-table-view`/`-board-view`/`-timeline-view`; do not re-port
  `shared.tsx` (including its 4-way view types — `ViewType` here is
  `table | board | timeline` only).
- **View persistence** — `useView().createView/saveView` is app-shell
  wiring (§6), not block surface.
- **Nested `FilterGroup` editing** — the demo is flat; `groupConditions()`
  nesting is out of scope until a sentence grammar for groups exists.
- **Multi-select/range value editing** — inherited for free from `ValueInput`
  (`in`/`between`/`multiEnum` editors); no sentence-specific work.

## 9. Conventions & gotchas

- TS 7 strict: `verbatimModuleSyntax` (`import type` for all type-only
  imports), relative imports keep `.ts`/`.tsx` extensions,
  `noUncheckedIndexedAccess` (guard `columnsConfig[0]`), `noUnusedLocals/Parameters`.
- Biome (root config, organize-imports `all`): import order — package
  (`@adistack/data-explorer`, `@tabler/icons-react`, `motion/react`, `react`) →
  `@/components/ui/*` / `@/lib/utils` → relative `./…`. Tabs, double quotes.
- No `console.*` (the library never logs; surfacing is via `validateCondition`
  codes and props).
- TanStack table is **v9** — use `table.state.dataFilters` +
  `setDataFilters/removeDataFilter` feature APIs; never mutate `table.options`.
- The registry item's `files[].path` values must match the on-disk authoring
  paths exactly (AGENTS.md "keep in sync" rule); the aggregator's
  `registryDependencies` must list the new block or `shadcn add data-explorer`
  installs an incomplete bundle.
- `components/package.json` needs `motion` added for workspace `tsc -b` to
  pass (the package is private; the registry item's `dependencies` is what
  consumers get).
- Any change under `components/` or `registry.json` is publishable surface →
  **changeset required** (`bunx changeset`) or the `checks.yml` CI fails.
- Icons: `@tabler/icons-react` with `strokeWidth={2.25}` and `className="size-3.5 …"`
  conventions used across the existing blocks; do not import `lucide-react`.

## 10. Verify

1. `cd components && bun run check:lint && bun run check:types` (authoring
   copy), then root `bun run check:lint` (no `--fix`) + `bun run check:types`
   (workspace `tsc -b`).
2. `bunx vitest run` from `package/` — untouched, but confirms no accidental
   core edits.
3. Example: `bun run dev` from `examples/` (port 4000), open the
   `filter-sentence` demo — verify Edit morph, row add/remove/toggle, Save
   syncing `FilterBar` chips, reduced-motion fallback (emulate
   `prefers-reduced-motion`), and the empty-sentence state.
4. Consumer: install the block in recruiter-mg (§7), `bun run check:types`,
   then verify on the running dev server (port 4020, `/dev/data-explorer`)
   with `agent-browser` per recruiter-mg's AGENTS.md — sentence renders
   committed filters, Edit→edit→Save round-trips through
   `table.state.dataFilters`, and `agent-tail tail browser -n 50` is clean.
5. Commit as `feat(components): add filter-sentence block (sentence ↔ builder
   morph)` with a changeset bumping `@adistack/data-explorer-ui`-adjacent
   minor.
