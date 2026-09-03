import type { ComponentType } from "react";

import { BoardViewExample } from "./board-view.tsx";
import { DisplayOptions } from "./display-options.tsx";
import { FilterBarExample } from "./filter-bar.tsx";
import { InfiniteScroll } from "./infinite-scroll.tsx";
import { SavedViews } from "./saved-views.tsx";
import { SelectionBatch } from "./selection-batch.tsx";
import { SimpleTable } from "./simple-table.tsx";
import { SqlPreviewExample } from "./sql-preview.tsx";

export type ExampleMeta = {
	slug: string;
	title: string;
	files: string[];
	description: string;
	component: ComponentType;
};

export const EXAMPLES: ExampleMeta[] = [
	{
		component: SimpleTable,
		description: "Provider, filter bar, virtual table.",
		files: [
			"examples/simple-table.tsx",
			"components/explorer-shell.tsx",
			"lib/tasks.ts",
		],
		slug: "simple-table",
		title: "Simple Table",
	},
	{
		component: FilterBarExample,
		description: "Chips, combinators, live state.",
		files: [
			"examples/filter-bar.tsx",
			"components/explorer-shell.tsx",
			"lib/tasks.ts",
		],
		slug: "filter-bar",
		title: "Filter Bar",
	},
	{
		component: DisplayOptions,
		description: "Columns, sorting, density.",
		files: ["examples/display-options.tsx", "components/explorer-shell.tsx"],
		slug: "display-options",
		title: "Display Options",
	},
	{
		component: SelectionBatch,
		description: "Checkboxes + floating batch bar.",
		files: ["examples/selection-batch.tsx", "components/explorer-shell.tsx"],
		slug: "selection-batch",
		title: "Selection & Batch Menu",
	},
	{
		component: BoardViewExample,
		description: "Group by status, drag to move.",
		files: ["examples/board-view.tsx", "components/explorer-shell.tsx"],
		slug: "board-view",
		title: "Board View",
	},
	{
		component: InfiniteScroll,
		description: "Cursor pages over 500 rows.",
		files: ["examples/infinite-scroll.tsx", "lib/tasks.ts"],
		slug: "infinite-scroll",
		title: "Infinite Scroll",
	},
	{
		component: SavedViews,
		description: "Apply, save, reset named views.",
		files: ["examples/saved-views.tsx", "components/explorer-shell.tsx"],
		slug: "saved-views",
		title: "Saved Views",
	},
	{
		component: SqlPreviewExample,
		description: "Filters to Postgres WHERE.",
		files: [
			"examples/sql-preview.tsx",
			"lib/tasks.ts",
			"components/explorer-shell.tsx",
		],
		slug: "sql-preview",
		title: "SQL Preview",
	},
];
