import type { Density } from "@adistack/data-explorer";
import { useDataExplorerContext } from "@adistack/data-explorer";
import { IconLoader2 } from "@tabler/icons-react";
import { FlexRender } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";

import { cn } from "@/lib/utils";
import {
	SelectAllCheckbox,
	SelectionCheckbox,
} from "../batch-menu/selection-checkbox.tsx";

const DENSITY_ROW_HEIGHTS: Record<Density, number> = {
	comfortable: 36,
	compact: 28,
	spacious: 48,
};
const SELECT_COLUMN_WIDTH = 32;

const ARIA_SORT = {
	asc: "ascending",
	desc: "descending",
} as const;

interface MessageRowProps {
	children: React.ReactNode;
	colSpan: number;
}

function MessageRow({ colSpan, children }: MessageRowProps): React.JSX.Element {
	return (
		<tbody>
			<tr>
				<td colSpan={colSpan}>
					<div className="flex h-32 items-center justify-center text-muted-foreground text-sm">
						{children}
					</div>
				</td>
			</tr>
		</tbody>
	);
}

interface VirtualTableProps<TItem> {
	emptyMessage?: string;
	onRowClick?: (row: TItem) => void;
}

export function VirtualTable<TItem extends Record<string, unknown>>({
	onRowClick,
	emptyMessage = "No items found",
}: VirtualTableProps<TItem> = {}): React.JSX.Element {
	const {
		data: { hasMore, isLoading, isLoadingMore, items: data, loadMoreRef },
		table,
	} = useDataExplorerContext<TItem>();

	const rowHeight = DENSITY_ROW_HEIGHTS[table.state.density ?? "comfortable"];
	const totalWidth = table.getTotalSize() + SELECT_COLUMN_WIDTH;

	const headers = table.getHeaderGroups()[0]?.headers ?? [];

	const scrollRef = useRef<HTMLDivElement>(null);
	const virtualizer = useVirtualizer({
		count: data.length,
		estimateSize: () => rowHeight,
		getScrollElement: () => scrollRef.current,
		overscan: 5,
	});

	const colSpan = headers.length + 1;

	let tableBody: React.ReactNode;
	if (isLoading) {
		tableBody = (
			<MessageRow colSpan={colSpan}>
				<div className="mr-2 animate-spin">
					<IconLoader2 className="h-4 w-4" />
				</div>
				Loading...
			</MessageRow>
		);
	} else if (data.length === 0) {
		tableBody = <MessageRow colSpan={colSpan}>{emptyMessage}</MessageRow>;
	} else {
		tableBody = (
			<tbody
				className="relative"
				style={{ height: virtualizer.getTotalSize() }}
			>
				{virtualizer.getVirtualItems().map((virtualRow) => {
					const row = table.getRowModel().rows[virtualRow.index];
					if (!row) return null;
					const selected = row.getIsSelected();
					return (
						<tr
							aria-rowindex={virtualRow.index + 1}
							className={cn(
								"absolute top-0 left-0 flex cursor-pointer border-b last:border-0 hover:bg-muted/50",
								selected && "bg-muted/80",
							)}
							key={row.id}
							onClick={() => onRowClick?.(row.original as TItem)}
							onKeyDown={(e) => {
								if (e.key === "Enter" || e.key === " ") {
									e.preventDefault();
									onRowClick?.(row.original as TItem);
								}
								if (e.key === "Escape") table.resetRowSelection();
							}}
							style={{
								height: `${virtualRow.size}px`,
								transform: `translateY(${virtualRow.start}px)`,
								width: totalWidth,
							}}
							tabIndex={0}
						>
							<td className="w-8 min-w-8">
								<SelectionCheckbox row={row} />
							</td>
							{row.getVisibleCells().map((cell) => (
								<td
									className="whitespace-nowrap px-2 align-middle text-sm"
									key={cell.id}
									style={{
										minWidth: cell.column.getSize(),
										width: cell.column.getSize(),
									}}
								>
									<FlexRender cell={cell} />
								</td>
							))}
						</tr>
					);
				})}
			</tbody>
		);
	}

	return (
		<div className="h-full rounded-lg border bg-card">
			<div className="h-full overflow-auto rounded-t-lg" ref={scrollRef}>
				<table className="w-full" style={{ minWidth: totalWidth }}>
					<thead className="sticky top-0 z-10 bg-card">
						<tr className="border-b">
							<th className="h-10 w-8 min-w-8">
								<SelectAllCheckbox />
							</th>
							{headers.map((header) => {
								const sorted = header.column.getIsSorted();
								return (
									<th
										aria-sort={sorted ? ARIA_SORT[sorted] : "none"}
										className="h-10 whitespace-nowrap px-2 text-left font-medium text-foreground text-sm"
										key={header.id}
										scope="col"
										style={{
											minWidth: header.getSize(),
											width: header.getSize(),
										}}
									>
										<FlexRender header={header} />
									</th>
								);
							})}
						</tr>
					</thead>

					{tableBody}
				</table>

				{!!hasMore && <div className="h-px" ref={loadMoreRef} />}
			</div>
			{!!isLoadingMore && (
				<div className="flex items-center justify-center py-3 text-muted-foreground text-sm">
					<div className="mr-2 animate-spin">
						<IconLoader2 className="size-4" />
					</div>
					Loading more...
				</div>
			)}
		</div>
	);
}
