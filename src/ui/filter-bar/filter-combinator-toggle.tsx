import { useCallback } from "react";

import { cn } from "../primitives";

interface FilterCombinatorToggleProps {
  combinator: "and" | "or";
  onChange: (combinator: "and" | "or") => void;
}

export function FilterCombinatorToggle({
  combinator,
  onChange,
}: FilterCombinatorToggleProps) {
  const handleClick = useCallback(() => {
    onChange(combinator === "and" ? "or" : "and");
  }, [combinator, onChange]);

  return (
    <button
      className={cn(
        "inline-flex h-5 items-center rounded px-1 font-medium text-[10px] text-muted-foreground uppercase tracking-wide transition-colors hover:bg-muted hover:text-foreground",
        combinator === "or" && "text-orange-600 hover:text-orange-700",
      )}
      onClick={handleClick}
      type="button"
    >
      {combinator === "and" ? "and" : "or"}
    </button>
  );
}
