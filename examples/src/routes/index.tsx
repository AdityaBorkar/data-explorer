import { RootLayout } from "#/components/layout/root.tsx";
import { EXAMPLES } from "#/examples";

export default function Page() {
	return (
		<RootLayout className="w-full max-w-2xl p-8">
			<div>
				<h1 className="mb-1 font-semibold text-2xl">Examples</h1>
				<p className="mb-6 text-muted-foreground text-sm">List of examples.</p>
				<nav className="grid gap-2">
					{EXAMPLES.map((ex) => (
						<a
							className="rounded-md border border-border bg-card p-4 transition-colors hover:border-primary"
							href={`/${ex.slug}`}
							key={ex.slug}
						>
							<span className="block font-medium text-sm">{ex.title}</span>
							<span className="block text-muted-foreground text-xs">
								{ex.description}
							</span>
						</a>
					))}
				</nav>
			</div>
		</RootLayout>
	);
}
