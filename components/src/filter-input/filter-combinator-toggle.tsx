import { cn } from "@/lib/utils";

interface FilterCombinatorToggleProps {
	combinator: "and" | "or";
	onChange: (combinator: "and" | "or") => void;
}

export function FilterCombinatorToggle({
	combinator,
	onChange,
}: FilterCombinatorToggleProps): React.JSX.Element {
	return (
		<button
			className={cn(
				"inline-flex h-5 items-center rounded px-1 font-medium text-[10px] text-muted-foreground uppercase tracking-wide transition-colors hover:bg-muted hover:text-foreground",
				combinator === "or" && "text-orange-600 hover:text-orange-700",
			)}
			onClick={() => onChange(combinator === "and" ? "or" : "and")}
			type="button"
		>
			{combinator}
		</button>
	);
}
