import { useDataExplorerContext } from "@adistack/data-explorer";
import type { DropResult } from "@hello-pangea/dnd";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import type { CSSProperties } from "react";
import { useCallback, useMemo } from "react";

interface BoardViewProps<TItem extends Record<string, unknown>> {
	getRowId: (item: TItem) => string;
	renderCard?: (item: TItem, meta: { isDragging: boolean }) => React.ReactNode;
}

const UNGROUPED_KEY = "__ungrouped";

function readGroupValue<TItem extends Record<string, unknown>>(
	item: TItem,
	groupBy: string | null,
): string | null {
	if (!groupBy) return null;
	const rec = item as unknown as Record<string, unknown>;
	const v = rec[groupBy];
	if (v === null || v === undefined) return null;
	return String(v);
}

export function BoardView<TItem extends Record<string, unknown>>({
	renderCard,
	getRowId,
}: BoardViewProps<TItem>): React.JSX.Element {
	const { columnsConfig, data, onMove, table } =
		useDataExplorerContext<TItem>();
	const { items } = data;

	const groupBy = table.state.grouping[0] ?? null;

	const groupByColumn = useMemo(
		() => columnsConfig.find((c) => c.id === groupBy),
		[columnsConfig, groupBy],
	);

	const columns = useMemo(() => groupByColumn?.options ?? [], [groupByColumn]);

	const groupedItems = useMemo(() => {
		const groups = new Map<string, TItem[]>();
		for (const col of columns) groups.set(col.value, []);
		groups.set(UNGROUPED_KEY, []);
		for (const item of items) {
			const key = readGroupValue(item, groupBy) ?? UNGROUPED_KEY;
			const list = groups.get(key);
			if (list) list.push(item);
			else groups.set(key, [item]);
		}
		return groups;
	}, [items, columns, groupBy]);

	const visibleColumns = useMemo(() => {
		const ungrouped = groupedItems.get(UNGROUPED_KEY) ?? [];
		if (ungrouped.length === 0) return columns;
		return [...columns, { label: "Ungrouped", value: UNGROUPED_KEY }];
	}, [columns, groupedItems]);

	const groupByColumnId = groupByColumn?.id;

	const handleDragEnd = useCallback(
		(result: DropResult) => {
			if (!result.destination || !onMove || !groupByColumnId) return;

			const fromGroup = result.source.droppableId;
			const toGroup = result.destination.droppableId;
			if (fromGroup === toGroup) return;

			onMove({
				columnId: groupByColumnId,
				fromGroup,
				itemId: result.draggableId,
				toGroup,
			});
		},
		[onMove, groupByColumnId],
	);

	if (!groupByColumn) {
		return (
			<div className="flex h-full items-center justify-center text-muted-foreground text-sm">
				No groupBy column configured
			</div>
		);
	}

	return (
		<DragDropContext onDragEnd={handleDragEnd}>
			<div className="flex h-full gap-4 overflow-x-auto p-4">
				{visibleColumns.map((col) => (
					<div className="flex w-72 shrink-0 flex-col" key={col.value}>
						<div className="mb-2 font-medium text-sm">{col.label}</div>
						<Droppable droppableId={col.value}>
							{(provided, snapshot) => (
								<div
									className="flex flex-1 flex-col gap-2 rounded-lg border bg-muted/30 p-2"
									ref={provided.innerRef}
									{...provided.droppableProps}
									style={{
										backgroundColor: snapshot.isDraggingOver
											? "var(--muted)"
											: undefined,
									}}
								>
									{(groupedItems.get(col.value) ?? []).map((item, index) => {
										const id = getRowId(item);
										return (
											<Draggable draggableId={id} index={index} key={id}>
												{(dragProvided, dragSnapshot) => {
													const { style, ...draggableProps } =
														dragProvided.draggableProps;
													return (
														<div
															ref={dragProvided.innerRef}
															{...draggableProps}
															{...dragProvided.dragHandleProps}
															style={style as CSSProperties | undefined}
														>
															{renderCard ? (
																renderCard(item, {
																	isDragging: dragSnapshot.isDragging,
																})
															) : (
																<div className="rounded-md border bg-card p-3 text-sm shadow-xs">
																	{String(
																		readGroupValue(item, groupByColumn.id) ??
																			id,
																	)}
																</div>
															)}
														</div>
													);
												}}
											</Draggable>
										);
									})}
									{provided.placeholder}
								</div>
							)}
						</Droppable>
					</div>
				))}
			</div>
		</DragDropContext>
	);
}
