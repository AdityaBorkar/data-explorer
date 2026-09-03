import { groupConditions } from "../../core/features/data-filtering/filter-grouping.ts";
import type { ColumnConfig, FilterCondition } from "../../core/types.ts";
import { FilterChip } from "./filter-chip.tsx";
import { FilterCombinatorToggle } from "./filter-combinator-toggle.tsx";

interface FilterChipGroupProps {
	columnsConfig: ColumnConfig[];
	conditions: FilterCondition[];
	focusedChipIndex: number | null;
	handleCombinatorChange: (index: number, combinator: "and" | "or") => void;
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
	const combinatorIndexOf = (id: string): number => indexById.get(id) ?? -1;

	if (group.conditions.length <= 1 || group.combinator === "and") {
		return (
			<>
				{conditions.map((cond, i) => (
					<ChipWithCombinator
						columnsConfig={columnsConfig}
						combinatorIndex={i}
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
						<FilterCombinatorToggle combinator="or" onChange={() => {}} />
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
									columnsConfig={columnsConfig}
									combinatorIndex={combinatorIndexOf(cond.id)}
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
							columnsConfig={columnsConfig}
							combinatorIndex={combinatorIndexOf(item.id)}
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
	condition,
	combinatorIndex,
	columnsConfig,
	focusedChipIndex,
	handleCombinatorChange,
	removeCondition,
	setFocusedChipIndex,
	showCombinator,
	updateCondition,
}: {
	condition: FilterCondition;
	combinatorIndex: number;
	columnsConfig: ColumnConfig[];
	focusedChipIndex: number | null;
	handleCombinatorChange: (index: number, combinator: "and" | "or") => void;
	removeCondition: (id: string) => void;
	setFocusedChipIndex: (index: number | null) => void;
	showCombinator: boolean;
	updateCondition: (id: string, updates: Partial<FilterCondition>) => void;
}) {
	const col = columnsConfig.find((c) => c.id === condition.columnId);
	if (!col) return null;

	return (
		<span>
			{!!showCombinator && (
				<FilterCombinatorToggle
					combinator={condition.combinator}
					onChange={(c) => handleCombinatorChange(combinatorIndex, c)}
				/>
			)}
			<FilterChip
				column={col}
				condition={condition}
				onRemove={removeCondition}
				onSelect={() => setFocusedChipIndex(combinatorIndex)}
				onUpdate={updateCondition}
				selected={focusedChipIndex === combinatorIndex}
			/>
		</span>
	);
}
