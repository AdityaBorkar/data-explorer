import { useMemo } from "react";

import { groupConditions } from "../../core/features/data-filtering/filter-grouping.ts";
import type {
	ColumnConfig,
	FilterCondition,
	FilterGroup,
} from "../../core/types.ts";
import { isFilterGroup } from "../../core/types.ts";
import { FilterChip } from "./filter-chip.tsx";
import { FilterCombinatorToggle } from "./filter-combinator-toggle.tsx";

export interface FilterChipGroupCallbacks {
	handleCombinatorChange: (id: string, combinator: "and" | "or") => void;
	removeCondition: (id: string) => void;
	setFocusedChipIndex: (index: number | null) => void;
	updateCondition: (id: string, updates: Partial<FilterCondition>) => void;
}

interface FilterChipGroupProps extends FilterChipGroupCallbacks {
	columnsConfig: ColumnConfig[];
	conditions: FilterCondition[];
	focusedChipIndex: number | null;
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
	const group = useMemo(() => groupConditions(conditions), [conditions]);
	const indexById = useMemo(
		() => new Map(conditions.map((c, i) => [c.id, i] as const)),
		[conditions],
	);

	if (conditions.length === 0) return null;

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

				if (isFilterGroup(item)) {
					return (
						<AndBracket
							columnsConfig={columnsConfig}
							focusedChipIndex={focusedChipIndex}
							group={item}
							handleCombinatorChange={handleCombinatorChange}
							indexById={indexById}
							key={item.id}
							orSeparator={orSeparator}
							removeCondition={removeCondition}
							setFocusedChipIndex={setFocusedChipIndex}
							updateCondition={updateCondition}
						/>
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

function AndBracket({
	group,
	columnsConfig,
	focusedChipIndex,
	handleCombinatorChange,
	indexById,
	orSeparator,
	removeCondition,
	setFocusedChipIndex,
	updateCondition,
}: FilterChipGroupCallbacks & {
	columnsConfig: ColumnConfig[];
	focusedChipIndex: number | null;
	group: FilterGroup;
	indexById: Map<string, number>;
	orSeparator: React.ReactNode;
}) {
	return (
		<span>
			{orSeparator}
			<span className="text-muted-foreground text-xs">(</span>
			{group.conditions.map((child, i) => {
				if (isFilterGroup(child)) {
					return (
						<AndBracket
							columnsConfig={columnsConfig}
							focusedChipIndex={focusedChipIndex}
							group={child}
							handleCombinatorChange={handleCombinatorChange}
							indexById={indexById}
							key={child.id}
							orSeparator={null}
							removeCondition={removeCondition}
							setFocusedChipIndex={setFocusedChipIndex}
							updateCondition={updateCondition}
						/>
					);
				}
				return (
					<ChipWithCombinator
						chipIndex={indexById.get(child.id) ?? -1}
						columnsConfig={columnsConfig}
						condition={child}
						focusedChipIndex={focusedChipIndex}
						handleCombinatorChange={handleCombinatorChange}
						key={child.id}
						removeCondition={removeCondition}
						setFocusedChipIndex={setFocusedChipIndex}
						showCombinator={i > 0}
						updateCondition={updateCondition}
					/>
				);
			})}
			<span className="text-muted-foreground text-xs">)</span>
		</span>
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
