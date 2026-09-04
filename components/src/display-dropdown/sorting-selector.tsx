import { useDataExplorerContext } from "@adistack/data-explorer";
import {
	IconArrowsSort,
	IconSortAscending,
	IconSortDescending,
} from "@tabler/icons-react";
import { useCallback } from "react";

import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

export function SortingSelector(): React.JSX.Element {
	const { table } = useDataExplorerContext();

	const visibleColumns = table.getVisibleLeafColumns();
	const sorting = table.state.sorting;
	const current = sorting[0];
	const currentId = current?.id;
	const currentDesc = current?.desc ?? false;
	const isAscending = !currentDesc;

	const handleSortColumnChange = useCallback(
		(value: string) => {
			table.setSorting([{ desc: currentDesc, id: value }]);
		},
		[table, currentDesc],
	);

	const toggleSortDirection = useCallback(() => {
		if (!currentId) return;
		table.setSorting([{ desc: !currentDesc, id: currentId }]);
	}, [table, currentId, currentDesc]);

	return (
		<div className="p-3">
			<div className="mb-2 flex items-center gap-1.5 font-medium text-muted-foreground text-xs">
				<IconArrowsSort className="size-3.5" />
				Sort
			</div>
			<div className="flex items-center gap-2">
				<Select
					onValueChange={handleSortColumnChange}
					value={currentId ?? undefined}
				>
					<SelectTrigger className="h-8 flex-1" size="sm">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectGroup>
							<SelectLabel>Column</SelectLabel>
							{visibleColumns.map((column) => {
								const meta = column.columnDef.meta;
								return (
									<SelectItem key={column.id} value={column.id}>
										{meta?.displayName ?? column.id}
									</SelectItem>
								);
							})}
						</SelectGroup>
					</SelectContent>
				</Select>
				<button
					aria-label={`Sort ${isAscending ? "ascending" : "descending"}`}
					className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-input transition-colors hover:bg-muted"
					onClick={toggleSortDirection}
					type="button"
				>
					{isAscending ? (
						<IconSortAscending className="size-4" />
					) : (
						<IconSortDescending className="size-4" />
					)}
				</button>
			</div>
		</div>
	);
}
