import { IconBrandGithub, IconExternalLink } from "@tabler/icons-react";
import { useEffect, useState } from "react";

import { EXAMPLES } from "#/examples";
import { GITHUB_EXAMPLES_PREFIX } from "#/lib/utils";

type SourceTab = { name: string; content: string };

export function SourcePanel({ exampleId }: { exampleId: string }) {
	const example = EXAMPLES.find((ex) => ex.slug === exampleId);
	const [activeTab, setActiveTab] = useState(0);
	const [tabs, setTabs] = useState<SourceTab[]>([]);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!example) return;
		setActiveTab(0);
		setTabs([]);
		setError(null);
		let cancelled = false;
		// Raw file contents come from the `/api/sources` route —
		// no build-time codegen, the server reads `src/` from disk.
		Promise.all(
			example.files.map(async (rel): Promise<SourceTab> => {
				const res = await fetch(`/api/sources/${rel}`);
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const data = (await res.json()) as { content: string };
				return { content: data.content, name: rel.split("/").pop() ?? rel };
			}),
		)
			.then((loaded) => {
				if (!cancelled) setTabs(loaded);
			})
			.catch(() => {
				if (!cancelled) setError("Could not load sources.");
			});
		return () => {
			cancelled = true;
		};
	}, [example]);

	if (!example) return null;
	const current = tabs[activeTab] ?? tabs[0];
	const currentRel =
		example.files.find((rel) => rel.endsWith(`/${current?.name ?? ""}`)) ??
		example.files[0] ??
		`examples/${example.slug}.tsx`;
	const githubUrl = `${GITHUB_EXAMPLES_PREFIX}/${currentRel}`;

	return (
		<aside className="flex w-2xl shrink-0 flex-col border-border border-l bg-card">
			<div className="flex items-center justify-between border-border border-b px-4 py-2">
				<span className="font-medium text-sm">Source</span>
				<a
					className="inline-flex items-center gap-1.5 text-muted-foreground text-xs transition-colors hover:text-foreground"
					href={githubUrl}
					rel="noopener noreferrer"
					target="_blank"
				>
					<IconBrandGithub className="size-3.5" />
					View on GitHub
					<IconExternalLink className="size-3" />
				</a>
			</div>
			<div className="flex border-border border-b">
				{tabs.map((tab, i) => (
					<button
						className={`border-b-2 px-3 py-1.5 text-xs transition-colors ${
							i === activeTab
								? "border-primary font-medium text-foreground"
								: "border-transparent text-muted-foreground hover:text-foreground"
						}`}
						key={tab.name}
						onClick={() => setActiveTab(i)}
						type="button"
					>
						{tab.name}
					</button>
				))}
			</div>
			<pre className="grow overflow-auto p-4 text-xs leading-relaxed">
				<code>{error ?? current?.content ?? "Loading…"}</code>
			</pre>
		</aside>
	);
}
