import {
	isSearchColumn,
	requiresValue,
	useDataExplorerContext,
	useInlineFilterFlow,
} from "@adistack/data-explorer";
import { IconFilterX, IconSearch } from "@tabler/icons-react";
import { useCallback, useEffect, useState } from "react";

import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ColumnSelector } from "./column-selector.tsx";
import { FilterChipGroup } from "./filter-chip-group.tsx";
import { OperatorSelector } from "./operator-selector.tsx";
import { useFilterBarKeyboard } from "./use-filter-bar-keyboard.ts";
import { ValueInput } from "./value-input.tsx";

interface FilterBarProps {
	className?: string;
}

export function FilterBar({ className }: FilterBarProps): React.JSX.Element {
	const { columnsConfig, table } = useDataExplorerContext();
	const filterConditions = table.state.dataFilters;
	const {
		addDataFilter,
		clearDataFilters,
		removeDataFilter,
		updateDataFilter,
	} = table;

	const [popoverOpen, setPopoverOpen] = useState(false);

	const { state: flow, actions } = useInlineFilterFlow({
		columnsConfig,
		onAdd: addDataFilter,
	});

	useEffect(() => {
		if (flow.phase === "column") setPopoverOpen(true);
		if (flow.phase === "idle") setPopoverOpen(false);
	}, [flow.phase]);

	const keyboard = useFilterBarKeyboard({
		conditions: filterConditions,
		inputValue: flow.inputValue,
		onRemove: removeDataFilter,
		onResetFlow: () => {
			actions.reset();
			setPopoverOpen(false);
		},
		popoverOpen,
	});
	const {
		containerRef,
		focusedChipIndex,
		setFocusedChipIndex,
		focusInput,
		handleInputKeyDown,
		inputRef,
	} = keyboard;

	const closeAndFocus = useCallback(() => {
		setPopoverOpen(false);
		focusInput();
	}, [focusInput]);

	const commitCondition = useCallback(() => {
		actions.commit();
		closeAndFocus();
	}, [actions, closeAndFocus]);

	const handleClearAll = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation();
			clearDataFilters();
			setFocusedChipIndex(null);
			focusInput();
		},
		[clearDataFilters, setFocusedChipIndex, focusInput],
	);

	const handleContainerClick = useCallback(
		(e: React.MouseEvent) => {
			if (e.target === e.currentTarget) {
				focusInput();
				setFocusedChipIndex(null);
			}
		},
		[focusInput, setFocusedChipIndex],
	);

	const handleCombinatorChange = useCallback(
		(id: string, combinator: "and" | "or") => {
			updateDataFilter(id, { combinator });
		},
		[updateDataFilter],
	);

	return (
		<div className={className}>
			<div
				aria-expanded={popoverOpen}
				aria-label="Filter conditions"
				className={cn(
					"flex h-9 w-full min-w-0 items-center gap-1 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs transition-colors",
					"focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
					"placeholder:text-muted-foreground",
				)}
				data-slot="filter-bar"
				onClick={handleContainerClick}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						inputRef.current?.focus();
					}
				}}
				ref={containerRef}
				role="combobox"
				tabIndex={-1}
			>
				<IconSearch className="size-4 shrink-0 text-muted-foreground" />

				<FilterChipGroup
					columnsConfig={columnsConfig}
					conditions={filterConditions}
					focusedChipIndex={focusedChipIndex}
					handleCombinatorChange={handleCombinatorChange}
					removeCondition={removeDataFilter}
					setFocusedChipIndex={setFocusedChipIndex}
					updateCondition={updateDataFilter}
				/>

				<input
					aria-label="Filter input"
					className="min-w-0 grow bg-transparent text-sm outline-none placeholder:text-muted-foreground"
					onChange={(e) => actions.handleInputChange(e.target.value)}
					onFocus={() => setFocusedChipIndex(null)}
					onKeyDown={handleInputKeyDown}
					placeholder={
						filterConditions.length > 0 ? "Filter..." : "Filter (Ctrl+F)"
					}
					ref={inputRef}
					value={flow.inputValue}
				/>

				{filterConditions.length > 0 && (
					<button
						aria-label="Clear all filters"
						className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
						onClick={handleClearAll}
						type="button"
					>
						<IconFilterX className="size-4" />
					</button>
				)}
			</div>

			<Popover
				onOpenChange={(open) => {
					setPopoverOpen(open);
					if (!open) actions.reset();
				}}
				open={popoverOpen}
			>
				<PopoverTrigger className="sr-only" tabIndex={-1} />
				<PopoverContent align="start" className="w-80 p-0" side="bottom">
					<FilterPopoverContent
						actions={actions}
						columnsConfig={columnsConfig}
						flow={flow}
						onCloseAndFocus={closeAndFocus}
						onCommit={commitCondition}
					/>
				</PopoverContent>
			</Popover>
		</div>
	);
}

interface FilterPopoverContentProps {
	actions: ReturnType<typeof useInlineFilterFlow>["actions"];
	columnsConfig: ReturnType<typeof useDataExplorerContext>["columnsConfig"];
	flow: ReturnType<typeof useInlineFilterFlow>["state"];
	onCloseAndFocus: () => void;
	onCommit: () => void;
}

function FilterPopoverContent({
	flow,
	actions,
	columnsConfig,
	onCloseAndFocus,
	onCommit,
}: FilterPopoverContentProps): React.JSX.Element | null {
	if (flow.phase === "column") {
		return (
			<ColumnSelector
				columns={columnsConfig}
				onQuickValueSelect={(colId, val) => {
					actions.handleQuickValueSelect(colId, val);
					onCloseAndFocus();
				}}
				onSearchChange={actions.setSearchText}
				onSelect={(colId) => {
					actions.handleColumnSelect(colId);
					if (isSearchColumn(colId)) onCloseAndFocus();
				}}
				search={flow.inputValue}
			/>
		);
	}

	if (flow.phase === "operator" && flow.selectedColumn) {
		return (
			<OperatorSelector
				column={flow.selectedColumn}
				onSearchChange={actions.setSearchText}
				onSelect={(op) => {
					actions.handleOperatorSelect(op);
					if (!requiresValue(op)) {
						onCloseAndFocus();
					}
				}}
				search={flow.inputValue}
			/>
		);
	}

	if (
		flow.phase === "value" &&
		flow.selectedColumn &&
		flow.selectedOperator &&
		!flow.needsNullValue
	) {
		const isGlobalSearch =
			flow.selectedOperator === "contains" &&
			flow.selectedColumnId !== null &&
			isSearchColumn(flow.selectedColumnId);
		return (
			<div className="p-2">
				<div className="mb-2 text-muted-foreground text-xs">
					{flow.selectedColumn.displayName}{" "}
					{isGlobalSearch ? "contains" : "— enter value"}
				</div>
				<ValueInput
					column={flow.selectedColumn}
					onChange={actions.setPendingValue}
					onCommit={onCommit}
					operator={flow.selectedOperator}
					value={flow.pendingValue}
				/>
				{flow.error !== null && (
					<p className="mt-1 text-destructive text-xs" role="alert">
						{flow.error}
					</p>
				)}
				<div className="mt-2 flex justify-end">
					<button
						className="rounded-md bg-primary px-3 py-1 text-primary-foreground text-xs"
						onClick={onCommit}
						type="button"
					>
						Apply
					</button>
				</div>
			</div>
		);
	}

	return null;
}
