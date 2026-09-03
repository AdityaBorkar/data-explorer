import { useDataExplorerContext } from "@adistack/data-explorer";
import { IconLineHeight } from "@tabler/icons-react";

import { cn } from "@/lib/utils";

const DENSITY_OPTIONS = [
	{ label: "Compact", value: "compact" },
	{ label: "Comfortable", value: "comfortable" },
	{ label: "Spacious", value: "spacious" },
] as const;

export function SpacingDensitySelector(): React.JSX.Element {
	const { table } = useDataExplorerContext();
	const density = table.state.density ?? "comfortable";

	return (
		<div className="p-3">
			<div className="mb-2 flex items-center gap-1.5 font-medium text-muted-foreground text-xs">
				<IconLineHeight className="size-3.5" />
				Density
			</div>
			<div className="flex gap-1">
				{DENSITY_OPTIONS.map((opt) => (
					<button
						className={cn(
							"flex-1 rounded-md border px-2 py-1 text-xs transition-colors",
							density === opt.value
								? "border-primary bg-primary/10 font-medium text-primary"
								: "border-input text-muted-foreground hover:bg-muted hover:text-foreground",
						)}
						key={opt.value}
						onClick={() => table.setDensity(opt.value)}
						type="button"
					>
						{opt.label}
					</button>
				))}
			</div>
		</div>
	);
}
