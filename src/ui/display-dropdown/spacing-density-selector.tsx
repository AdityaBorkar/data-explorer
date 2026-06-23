import { IconLineHeight } from "@tabler/icons-react";
import { useCallback } from "react";

import { cn } from "@/lib/utils";

import { useDisplayContext } from "../../core/context";

const DENSITY_OPTIONS = [
  { label: "Compact", value: "compact" },
  { label: "Comfortable", value: "comfortable" },
  { label: "Spacious", value: "spacious" },
] as const;

export function SpacingDensitySelector() {
  const { display, updateDisplay } = useDisplayContext();

  const handleDensityChange = useCallback(
    (value: "compact" | "comfortable" | "spacious") => {
      updateDisplay({ density: value });
    },
    [updateDisplay],
  );

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
              display.density === opt.value
                ? "border-primary bg-primary/10 font-medium text-primary"
                : "border-input text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
            key={opt.value}
            onClick={() => handleDensityChange(opt.value)}
            type="button"
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
