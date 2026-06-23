import { IconLoader2 } from "@tabler/icons-react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useMemo, useRef } from "react";

import {
  useDataContext,
  useDisplayContext,
  useSelectionContext,
} from "../../core/context";
import { cn } from "../primitives";
import { SelectAllCheckbox, SelectionCheckbox } from "./selection-checkbox";

const DENSITY_ROW_HEIGHTS: Record<string, number> = {
  comfortable: 36,
  compact: 28,
  spacious: 48,
};
const DEFAULT_COLUMN_WIDTH = 150;

function getAriaSort(
  orderBy: string,
  orderType: "asc" | "desc",
  columnId: string,
): "ascending" | "descending" | "none" {
  if (orderBy !== columnId) return "none";
  return orderType === "asc" ? "ascending" : "descending";
}

export function VirtualTable<TItem extends Record<string, unknown>>({
  columnDefs,
  onRowClick,
  emptyMessage = "No items found",
  getRowId,
}: {
  columnDefs: ColumnDef<TItem>[];
  onRowClick?: (row: TItem) => void;
  emptyMessage?: string;
  getRowId: (row: TItem) => string;
}) {
  const { items, isLoading, isLoadingMore, hasMore, loadMoreRef } =
    useDataContext<TItem>();
  const { display } = useDisplayContext();
  const { clearSelection, selectedRowIds } = useSelectionContext();

  const table = useReactTable({
    columns: columnDefs,
    data: items,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => getRowId(row),
  });

  const columnSizing = table.getState().columnSizing;
  const columnWidths = useMemo(() => {
    const widths: Record<string, number> = {};
    for (const header of table.getFlatHeaders()) {
      widths[header.id] = columnSizing[header.id] ?? DEFAULT_COLUMN_WIDTH;
    }
    return widths;
  }, [table, columnSizing]);
  const totalWidth = useMemo(
    () => Object.values(columnWidths).reduce((sum, w) => sum + w, 0) + 32,
    [columnWidths],
  );
  const rowHeight = DENSITY_ROW_HEIGHTS[display.density] ?? 36;

  const headers = table.getHeaderGroups()[0]?.headers ?? [];

  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: items.length,
    estimateSize: () => rowHeight,
    getScrollElement: () => scrollRef.current,
    overscan: 5,
  });

  useEffect(() => {
    const rowSelection: Record<string, boolean> = {};
    for (const id of selectedRowIds) {
      if (table.getRowModel().rowsById[id]) {
        rowSelection[id] = true;
      }
    }
    table.setRowSelection(rowSelection);
  }, [table, selectedRowIds]);

  return (
    <div className="h-full rounded-lg border bg-card">
      <div className="h-full overflow-auto rounded-t-lg" ref={scrollRef}>
        <table className="w-full" style={{ minWidth: totalWidth || undefined }}>
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="border-b">
              <th className="h-10 w-8 min-w-8">
                <SelectAllCheckbox />
              </th>
              {headers.map((header) => (
                <th
                  aria-sort={getAriaSort(
                    display.orderBy,
                    display.orderType,
                    header.id,
                  )}
                  className="h-10 whitespace-nowrap px-2 text-left font-medium text-foreground text-sm"
                  key={header.id}
                  scope="col"
                  style={{
                    minWidth: columnWidths[header.id] ?? DEFAULT_COLUMN_WIDTH,
                    width: columnWidths[header.id] ?? DEFAULT_COLUMN_WIDTH,
                  }}
                >
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext(),
                  )}
                </th>
              ))}
            </tr>
          </thead>

          {isLoading ? (
            <tbody>
              <tr>
                <td colSpan={headers.length + 1}>
                  <div className="flex h-32 items-center justify-center text-muted-foreground text-sm">
                    <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </div>
                </td>
              </tr>
            </tbody>
          ) : items.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={headers.length + 1}>
                  <div className="flex h-32 items-center justify-center text-muted-foreground text-sm">
                    {emptyMessage}
                  </div>
                </td>
              </tr>
            </tbody>
          ) : (
            <tbody
              className="relative"
              style={{ height: virtualizer.getTotalSize() }}
            >
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const row = table.getRowModel().rows[virtualRow.index];
                if (!row) return null;
                return (
                  <tr
                    aria-rowindex={virtualRow.index + 1}
                    className={cn(
                      "absolute top-0 left-0 flex cursor-pointer border-b last:border-0 hover:bg-muted/50",
                      selectedRowIds.has(row.id) && "bg-muted/80",
                    )}
                    key={row.id}
                    onClick={() => onRowClick?.(row.original as TItem)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onRowClick?.(row.original as TItem);
                      }
                      if (e.key === "Escape") clearSelection();
                    }}
                    style={{
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                      width: totalWidth || "100%",
                    }}
                    tabIndex={0}
                  >
                    <td className="w-8 min-w-8">
                      <SelectionCheckbox rowId={row.id} />
                    </td>
                    {row.getVisibleCells().map((cell) => (
                      <td
                        className="whitespace-nowrap px-2 align-middle text-sm"
                        key={cell.id}
                        style={{
                          minWidth:
                            columnWidths[cell.column.id] ??
                            DEFAULT_COLUMN_WIDTH,
                          width:
                            columnWidths[cell.column.id] ??
                            DEFAULT_COLUMN_WIDTH,
                        }}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          )}
        </table>

        {hasMore && <div className="h-px" ref={loadMoreRef} />}
      </div>
      {isLoadingMore && (
        <div className="flex items-center justify-center py-3 text-muted-foreground text-sm">
          <IconLoader2 className="mr-2 size-4 animate-spin" />
          Loading more...
        </div>
      )}
    </div>
  );
}
