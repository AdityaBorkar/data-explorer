import type { DropResult } from "@hello-pangea/dnd";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import { type CSSProperties, useCallback, useMemo } from "react";

import {
  useCallbackContext,
  useConfigContext,
  useDataContext,
  useDisplayContext,
} from "../../../core/context.tsx";

interface BoardViewProps<TItem> {
  getRowId: (item: TItem) => string;
  renderCard?: (item: TItem, meta: { isDragging: boolean }) => React.ReactNode;
}

export function BoardView<TItem>({
  renderCard,
  getRowId,
}: BoardViewProps<TItem>) {
  const { items } = useDataContext<TItem>();
  const { display } = useDisplayContext();
  const { columnsConfig } = useConfigContext();
  const { onMove } = useCallbackContext();

  const groupByColumn = useMemo(
    () => columnsConfig.find((c) => c.id === display.groupBy),
    [columnsConfig, display.groupBy],
  );

  const columns = useMemo(() => {
    if (!groupByColumn?.options) return [];
    return groupByColumn.options;
  }, [groupByColumn]);

  const groupedItems = useMemo(() => {
    const groups: Record<string, TItem[]> = {};
    for (const col of columns) {
      groups[col.value] = [];
    }
    for (const item of items) {
      const groupValue = (item as Record<string, unknown>)[
        display.groupBy ?? ""
      ];
      const key = String(groupValue ?? "");
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }
    return groups;
  }, [items, columns, display.groupBy]);

  const handleDragEnd = useCallback(
    (result: DropResult) => {
      if (!result.destination) return;
      if (!onMove) return;
      if (!groupByColumn) return;

      const fromGroup = result.source.droppableId;
      const toGroup = result.destination.droppableId;
      if (fromGroup === toGroup) return;

      onMove({
        columnId: groupByColumn.id,
        fromGroup,
        itemId: result.draggableId,
        toGroup,
      });
    },
    [onMove, groupByColumn],
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
        {columns.map((col) => (
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
                  {(groupedItems[col.value] ?? []).map((item, index) => {
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
                              style={style as CSSProperties}
                            >
                              {renderCard ? (
                                renderCard(item, {
                                  isDragging: dragSnapshot.isDragging,
                                })
                              ) : (
                                <div className="rounded-md border bg-card p-3 text-sm shadow-xs">
                                  {String(
                                    (item as Record<string, unknown>)[
                                      groupByColumn.id
                                    ] ?? id,
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
