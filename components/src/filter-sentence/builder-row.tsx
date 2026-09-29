import type {
	ColumnConfig,
	ConditionValidationError,
	FilterCondition,
	FilterOperator,
} from "@adistack/data-explorer";
import {
	coerceFilterValue,
	getDefaultOperator,
	getOperatorLabel,
	getOperatorsForType,
} from "@adistack/data-explorer";
import { IconX } from "@tabler/icons-react";

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ValueInput } from "../filter-input/value-input.tsx";

interface SentenceBuilderRowProps {
	/** Column resolved from the condition (undefined for stale/unknown ids). */
	column: ColumnConfig | undefined;
	columns: ColumnConfig[];
	condition: FilterCondition;
	/** Validation failure for this row, computed once by `FilterSentence`. */
	error: ConditionValidationError | undefined;
	index: number;
	onPatch: (id: string, patch: Partial<FilterCondition>) => void;
	onRemove: (id: string) => void;
}

/**
 * One builder row: Where/And/Or connector, column + operator selects, value
 * editor, remove button. Edits stay local to the draft — commit happens only
 * on Save in `FilterSentence`.
 */
export function SentenceBuilderRow({
	column,
	columns,
	condition,
	error,
	index,
	onPatch,
	onRemove,
}: SentenceBuilderRowProps): React.JSX.Element {
	const operators = column
		? (column.operators ?? getOperatorsForType(column.type))
		: [];

	const handleColumnChange = (columnId: string): void => {
		const nextColumn = columns.find((candidate) => candidate.id === columnId);
		if (!nextColumn) return;
		const nextOperators =
			nextColumn.operators ?? getOperatorsForType(nextColumn.type);
		onPatch(
			condition.id,
			nextOperators.includes(condition.operator)
				? { columnId }
				: { columnId, operator: getDefaultOperator(nextColumn.type) },
		);
	};

	const handleOperatorChange = (operator: FilterOperator): void => {
		const { value } = coerceFilterValue(operator, condition.value);
		onPatch(condition.id, { operator, value });
	};

	return (
		<div
			aria-invalid={error ? true : undefined}
			className={cn(
				"flex flex-wrap items-center gap-2 rounded-md",
				error && "ring-1 ring-destructive/50",
			)}
			title={error?.message}
		>
			{index === 0 ? (
				<span
					className="w-14 text-right text-xs text-muted-foreground"
					title="First condition"
				>
					Where
				</span>
			) : (
				<button
					className={cn(
						"w-14 text-right text-xs",
						condition.combinator === "and"
							? "text-muted-foreground"
							: "text-primary hover:underline",
					)}
					onClick={() =>
						onPatch(condition.id, {
							combinator: condition.combinator === "and" ? "or" : "and",
						})
					}
					title="Toggle And / Or"
					type="button"
				>
					{condition.combinator === "and" ? "And" : "Or"}
				</button>
			)}
			<Select onValueChange={handleColumnChange} value={condition.columnId}>
				<SelectTrigger aria-label="Filter column" className="h-7 w-36 text-xs">
					<SelectValue placeholder="Field" />
				</SelectTrigger>
				<SelectContent className="min-w-36">
					{columns.map((candidate) => (
						<SelectItem key={candidate.id} value={candidate.id}>
							{candidate.displayName}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<Select onValueChange={handleOperatorChange} value={condition.operator}>
				<SelectTrigger
					aria-label="Filter operator"
					className="h-7 w-36 text-xs"
				>
					<SelectValue placeholder="Operator" />
				</SelectTrigger>
				<SelectContent className="min-w-36">
					{operators.map((operator) => (
						<SelectItem key={operator} value={operator}>
							{getOperatorLabel(operator)}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			{column ? (
				<div className="min-w-36 flex-1">
					<ValueInput
						column={column}
						onChange={(value) => onPatch(condition.id, { value })}
						onCommit={() => {}}
						operator={condition.operator}
						value={condition.value}
					/>
				</div>
			) : (
				<span className="flex-1 text-muted-foreground text-xs">
					Unknown column
				</span>
			)}
			<button
				aria-label="Remove condition"
				className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
				onClick={() => onRemove(condition.id)}
				type="button"
			>
				<IconX aria-hidden="true" className="size-3.5" />
			</button>
		</div>
	);
}
