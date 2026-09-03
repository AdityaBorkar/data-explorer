/** Example + system files this route may read from `src/`. */
const SOURCE_ALLOWLIST = new Set<string>([
	"examples/simple-table.tsx",
	"examples/filter-bar.tsx",
	"examples/display-options.tsx",
	"examples/selection-batch.tsx",
	"examples/board-view.tsx",
	"examples/infinite-scroll.tsx",
	"examples/saved-views.tsx",
	"examples/sql-preview.tsx",
	"components/explorer-shell.tsx",
	"components/layout/root.tsx",
	"components/layout/source.tsx",
	"components/ui/button.tsx",
	"components/ui/card.tsx",
	"lib/tasks.ts",
	"lib/utils.ts",
]);

// `src/` is one level up from this file: `src/app/api.sources.$.ts`.
const SRC_DIR = `${import.meta.dir}/../`;

/** `GET /api/sources/<rel>` — raw file contents for the source panel. */
export async function GET(request: Request): Promise<Response> {
	// Everything after the prefix is the relative path (`examples/x.tsx`);
	// the allowlist below rejects anything else (no traversal possible).
	const rel = new URL(request.url).pathname.replace("/api/sources/", "");
	if (!SOURCE_ALLOWLIST.has(rel))
		return Response.json(
			{
				detail: `Unknown source file "${rel}".`,
				status: 404,
				title: "Not Found",
				type: "about:blank",
			},
			{
				headers: { "content-type": "application/problem+json" },
				status: 404,
			},
		);
	const content = await Bun.file(`${SRC_DIR}${rel}`).text();
	return Response.json({ content, name: rel.split("/").pop() ?? rel });
}
