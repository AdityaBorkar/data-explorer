import type { TableFeatures } from "@adistack/data-explorer";
import { useDataExplorerContext } from "@adistack/data-explorer";
import { IconLayoutList } from "@tabler/icons-react";
import type { Column } from "@tanstack/react-table";
import { useCallback } from "react";

import { Checkbox } from "@/components/ui/checkbox";

export function DisplayColumnSelector() {
	const { table } = useDataExplorerContext();

	const columns = table.getAllLeafColumns();

	return (
		<div className="p-3">
			<div className="mb-2 flex items-center gap-1.5 font-medium text-muted-foreground text-xs">
				<IconLayoutList className="size-3.5" />
				Columns
			</div>
			<div className="flex flex-col gap-1">
				{columns.map((column) => (
					<ColumnVisibilityRow column={column} key={column.id} />
				))}
			</div>
		</div>
	);
}

function ColumnVisibilityRow({
	column,
}: {
	column: Column<TableFeatures, Record<string, unknown>>;
}) {
	const isVisible = column.getIsVisible();
	const meta = column.columnDef.meta;
	const Icon = meta?.icon as
		| React.ComponentType<{ className?: string }>
		| undefined;

	const toggle = useCallback(() => {
		column.toggleVisibility(!isVisible);
	}, [column, isVisible]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				toggle();
			}
		},
		[toggle],
	);

	const handleCheckedChange = useCallback(
		(checked: boolean | "indeterminate") => {
			column.toggleVisibility(checked !== false);
		},
		[column],
	);

	return (
		// biome-ignore lint/a11y/useSemanticElements: ARIA checkbox wrapping a Radix Checkbox (button); native input not applicable
		<div
			aria-checked={isVisible}
			className="flex cursor-pointer items-center gap-2 rounded-sm px-1 py-0.5 text-sm hover:bg-muted"
			onClick={toggle}
			onKeyDown={handleKeyDown}
			role="checkbox"
			tabIndex={0}
		>
			<Checkbox
				checked={isVisible}
				onCheckedChange={handleCheckedChange}
				tabIndex={-1}
			/>
			{!!Icon && <Icon className="size-3.5 shrink-0 text-muted-foreground" />}
			<span>{meta?.displayName ?? column.id}</span>
		</div>
	);
}
