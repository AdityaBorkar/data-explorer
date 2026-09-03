import type { ColumnConfig, DataExplorerColumnMeta } from "./types.ts";

export function extractColumnConfigs(
	defs: ReadonlyArray<{ id?: string; meta?: unknown }>,
): ColumnConfig[] {
	const result: ColumnConfig[] = [];
	defs.forEach((def, index) => {
		if (def.id == null) {
			console.warn(
				`[data-explorer] column at index ${index} missing id; skipped`,
			);
			return;
		}
		const meta = def.meta as DataExplorerColumnMeta | undefined;
		if (meta?.displayName == null || meta?.type == null) {
			console.warn(
				`[data-explorer] column "${def.id}" missing displayName/type; skipped`,
			);
			return;
		}
		result.push({ id: def.id, ...meta });
	});
	return result;
}
