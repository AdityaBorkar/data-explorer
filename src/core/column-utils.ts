import type { ColumnConfig, DataExplorerColumnMeta } from "./types.ts";

export function extractColumnConfigs(
  defs: ReadonlyArray<{ id?: string; meta?: unknown }>,
): ColumnConfig[] {
  const result: ColumnConfig[] = [];
  for (const def of defs) {
    if (def.id == null) continue;
    const meta = def.meta as DataExplorerColumnMeta | undefined;
    if (meta?.displayName == null || meta?.type == null) continue;
    result.push({ id: def.id, ...meta });
  }
  return result;
}
