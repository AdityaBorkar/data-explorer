import type {
	ColumnConfig,
	FilterCondition,
	FilterOperator,
} from "@adistack/data-explorer";
import {
	coerceFilterValue,
	formatFilterValue,
	getOperatorLabel,
} from "@adistack/data-explorer";
import { IconX } from "@tabler/icons-react";
import { useCallback, useState } from "react";

import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "#/components/ui/popover";
import { cn } from "#/lib/utils";
import { OperatorSelector } from "./operator-selector.tsx";
import { ValueInput } from "./value-input.tsx";

interface FilterChipProps {
	column: ColumnConfig;
	condition: FilterCondition;
	onRemove: (id: string) => void;
	onSelect: () => void;
	onUpdate: (id: string, updates: Partial<FilterCondition>) => void;
	selected: boolean;
}

export function FilterChip({
	condition,
	column,
	onUpdate,
	onRemove,
	selected,
	onSelect,
}: FilterChipProps) {
	const [editOpen, setEditOpen] = useState(false);
	const Icon = column.icon as
		| React.ComponentType<{ className?: string; strokeWidth?: number }>
		| undefined;
	const operatorLabel = getOperatorLabel(condition.operator);

	const handleRemove = useCallback(
		(e: React.MouseEvent | React.KeyboardEvent) => {
			e.stopPropagation();
			onRemove(condition.id);
		},
		[onRemove, condition.id],
	);

	const handleOperatorChange = useCallback(
		(operator: FilterOperator) => {
			const { value } = coerceFilterValue(operator, condition.value);
			onUpdate(condition.id, { operator, value });
		},
		[onUpdate, condition.id, condition.value],
	);

	const handleValueChange = (value: unknown) => {
		onUpdate(condition.id, { value });
	};

	const displayValue = formatFilterValue(
		condition.value,
		condition.operator,
		column,
	);

	return (
		<Popover onOpenChange={setEditOpen} open={editOpen}>
			<PopoverTrigger asChild={true}>
				<span
					className={cn(
						"inline-flex h-7 items-center gap-1 rounded-md border px-1.5 text-xs transition-colors",
						selected
							? "border-ring bg-muted"
							: "border-border bg-background hover:bg-muted/50",
					)}
					data-filter-chip={condition.id}
				>
					<button
						className="flex min-w-0 cursor-pointer items-center gap-1 bg-transparent"
						onClick={onSelect}
						type="button"
					>
						{!!Icon && (
							<Icon
								className="size-3.5 shrink-0 text-muted-foreground"
								strokeWidth={2.25}
							/>
						)}
						<span className="font-medium">{column.displayName}</span>
						<span className="text-muted-foreground">{operatorLabel}</span>
						{displayValue !== null && (
							<span className="max-w-24 truncate">{displayValue}</span>
						)}
					</button>
					<button
						aria-label={`Remove ${column.displayName} filter`}
						className="ml-0.5 shrink-0 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
						onClick={handleRemove}
						type="button"
					>
						<IconX className="size-3" />
					</button>
				</span>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-64 p-2">
				<div className="flex flex-col gap-2">
					<div className="font-medium text-muted-foreground text-xs">
						{column.displayName}
					</div>
					<OperatorSelector
						column={column}
						onSearchChange={() => {}}
						onSelect={handleOperatorChange}
						search=""
					/>
					<ValueInput
						column={column}
						onChange={handleValueChange}
						onCommit={() => setEditOpen(false)}
						operator={condition.operator}
						value={condition.value}
					/>
				</div>
			</PopoverContent>
		</Popover>
	);
}
