import { IconX } from "@tabler/icons-react";
import { useCallback, useEffect } from "react";

import { useSelectionContext } from "../../core/context";

export function BatchMenuBar({ children }: { children: React.ReactNode }) {
  const { clearSelection, selectedRowIds } = useSelectionContext();

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") clearSelection();
    },
    [clearSelection],
  );
  useEffect(() => {
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [handleEscape]);

  if (selectedRowIds.size === 0) return null;

  return (
    <div className="fade-in slide-in-from-bottom-2 fixed bottom-4 left-1/2 z-50 -translate-x-1/2 animate-in duration-150">
      <div className="flex items-center gap-3 rounded-lg border bg-background px-4 py-2.5 shadow-lg">
        {children}
        <button
          aria-label="Clear selection"
          className="ml-1 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          onClick={clearSelection}
          type="button"
        >
          <IconX className="size-4" />
        </button>
      </div>
    </div>
  );
}
