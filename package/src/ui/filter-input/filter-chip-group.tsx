import { groupConditions } from "../../core/features/data-filtering/filter-grouping.ts";
import type { ColumnConfig, FilterCondition } from "../../core/types.ts";
import { FilterChip } from "./filter-chip.tsx";
import { FilterCombinatorToggle } from "./filter-combinator-toggle.tsx";

interface FilterChipGroupProps {
	columnsConfig: ColumnConfig[];
	conditions: FilterCondition[];
	focusedChipIndex: number | null;
	handleCombinatorChange: (id: string, combinator: "and" | "or") => void;
	removeCondition: (id: string) => void;
	setFocusedChipIndex: (index: number | null) => void;
	updateCondition: (id: string, updates: Partial<FilterCondition>) => void;
}

export function FilterChipGroup({
	conditions,
	columnsConfig,
	removeCondition,
	updateCondition,
	focusedChipIndex,
	setFocusedChipIndex,
	handleCombinatorChange,
}: FilterChipGroupProps) {
	if (conditions.length === 0) return null;

	const group = groupConditions(conditions);
	const indexById = new Map(conditions.map((c, i) => [c.id, i] as const));

	if (group.conditions.length <= 1 || group.combinator === "and") {
		return (
			<>
				{conditions.map((cond, i) => (
					<ChipWithCombinator
						chipIndex={i}
						columnsConfig={columnsConfig}
						condition={cond}
						focusedChipIndex={focusedChipIndex}
						handleCombinatorChange={handleCombinatorChange}
						key={cond.id}
						removeCondition={removeCondition}
						setFocusedChipIndex={setFocusedChipIndex}
						showCombinator={i > 0}
						updateCondition={updateCondition}
					/>
				))}
			</>
		);
	}

	return (
		<>
			{group.conditions.map((item, g) => {
				const orSeparator =
					g > 0 ? (
						<span className="px-1 font-medium text-[10px] text-orange-600 uppercase">
							or
						</span>
					) : null;

				if ("conditions" in item) {
					const bracketConditions = item.conditions.filter(
						(c): c is FilterCondition => !("conditions" in c),
					);

					return (
						<span key={`group-${item.id}`}>
							{orSeparator}
							<span className="text-muted-foreground text-xs">(</span>
							{bracketConditions.map((cond, i) => (
								<ChipWithCombinator
									chipIndex={indexById.get(cond.id) ?? -1}
									columnsConfig={columnsConfig}
									condition={cond}
									focusedChipIndex={focusedChipIndex}
									handleCombinatorChange={handleCombinatorChange}
									key={cond.id}
									removeCondition={removeCondition}
									setFocusedChipIndex={setFocusedChipIndex}
									showCombinator={i > 0}
									updateCondition={updateCondition}
								/>
							))}
							<span className="text-muted-foreground text-xs">)</span>
						</span>
					);
				}

				return (
					<span key={item.id}>
						{orSeparator}
						<ChipWithCombinator
							chipIndex={indexById.get(item.id) ?? -1}
							columnsConfig={columnsConfig}
							condition={item}
							focusedChipIndex={focusedChipIndex}
							handleCombinatorChange={handleCombinatorChange}
							removeCondition={removeCondition}
							setFocusedChipIndex={setFocusedChipIndex}
							showCombinator={false}
							updateCondition={updateCondition}
						/>
					</span>
				);
			})}
		</>
	);
}

function ChipWithCombinator({
	chipIndex,
	condition,
	columnsConfig,
	focusedChipIndex,
	handleCombinatorChange,
	removeCondition,
	setFocusedChipIndex,
	showCombinator,
	updateCondition,
}: {
	chipIndex: number;
	condition: FilterCondition;
	columnsConfig: ColumnConfig[];
	focusedChipIndex: number | null;
	handleCombinatorChange: (id: string, combinator: "and" | "or") => void;
	removeCondition: (id: string) => void;
	setFocusedChipIndex: (index: number | null) => void;
	showCombinator: boolean;
	updateCondition: (id: string, updates: Partial<FilterCondition>) => void;
}) {
	const col = columnsConfig.find((c) => c.id === condition.columnId);
	if (!col) return null;

	return (
		<>
			{!!showCombinator && (
				<FilterCombinatorToggle
					combinator={condition.combinator}
					onChange={(c) => handleCombinatorChange(condition.id, c)}
				/>
			)}
			<FilterChip
				column={col}
				condition={condition}
				onRemove={removeCondition}
				onSelect={() => setFocusedChipIndex(chipIndex)}
				onUpdate={updateCondition}
				selected={focusedChipIndex === chipIndex}
			/>
		</>
	);
}
