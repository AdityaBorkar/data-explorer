import type {
	ColumnConfig,
	FilterCondition,
	FilterGroup,
} from "@adistack/data-explorer";
import { groupConditions, isFilterGroup } from "@adistack/data-explorer";
import { useMemo } from "react";

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

type SharedChipProps = Pick<
	FilterChipGroupProps,
	| "columnsConfig"
	| "focusedChipIndex"
	| "handleCombinatorChange"
	| "removeCondition"
	| "setFocusedChipIndex"
	| "updateCondition"
>;

export function FilterChipGroup({
	conditions,
	columnsConfig,
	removeCondition,
	updateCondition,
	focusedChipIndex,
	setFocusedChipIndex,
	handleCombinatorChange,
}: FilterChipGroupProps): React.JSX.Element | null {
	const group = useMemo(() => groupConditions(conditions), [conditions]);
	const indexById = useMemo(
		() => new Map(conditions.map((c, i) => [c.id, i] as const)),
		[conditions],
	);
	const colById = useMemo(
		() => new Map(columnsConfig.map((c) => [c.id, c] as const)),
		[columnsConfig],
	);

	if (conditions.length === 0) return null;

	const shared: SharedChipProps = {
		columnsConfig,
		focusedChipIndex,
		handleCombinatorChange,
		removeCondition,
		setFocusedChipIndex,
		updateCondition,
	};

	const isFlat = group.conditions.length <= 1 || group.combinator === "and";
	if (isFlat) {
		return (
			<>
				{conditions.map((cond, i) => (
					<ChipWithCombinator
						chipIndex={i}
						colById={colById}
						condition={cond}
						key={cond.id}
						showCombinator={i > 0}
						{...shared}
					/>
				))}
			</>
		);
	}

	return (
		<>
			{group.conditions.map((item, g) => {
				if (isFilterGroup(item)) {
					return (
						<AndBracket
							colById={colById}
							group={item}
							indexById={indexById}
							key={item.id}
							showOrSeparator={g > 0}
							{...shared}
						/>
					);
				}

				return (
					<span key={item.id}>
						{g > 0 && <OrSeparator />}
						<ChipWithCombinator
							chipIndex={indexById.get(item.id) ?? -1}
							colById={colById}
							condition={item}
							showCombinator={false}
							{...shared}
						/>
					</span>
				);
			})}
		</>
	);
}

function OrSeparator(): React.JSX.Element {
	return (
		<span className="px-1 font-medium text-[10px] text-orange-600 uppercase">
			or
		</span>
	);
}

function AndBracket({
	group,
	indexById,
	colById,
	showOrSeparator,
	...shared
}: SharedChipProps & {
	colById: Map<string, ColumnConfig>;
	group: FilterGroup;
	indexById: Map<string, number>;
	showOrSeparator: boolean;
}): React.JSX.Element {
	return (
		<span>
			{!!showOrSeparator && <OrSeparator />}
			<span className="text-muted-foreground text-xs">(</span>
			{group.conditions.map((child, i) => {
				if (isFilterGroup(child)) {
					return (
						<AndBracket
							colById={colById}
							group={child}
							indexById={indexById}
							key={child.id}
							showOrSeparator={false}
							{...shared}
						/>
					);
				}
				return (
					<ChipWithCombinator
						chipIndex={indexById.get(child.id) ?? -1}
						colById={colById}
						condition={child}
						key={child.id}
						showCombinator={i > 0}
						{...shared}
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
	showCombinator,
	colById,
	focusedChipIndex,
	handleCombinatorChange,
	removeCondition,
	setFocusedChipIndex,
	updateCondition,
}: SharedChipProps & {
	chipIndex: number;
	colById: Map<string, ColumnConfig>;
	condition: FilterCondition;
	showCombinator: boolean;
}): React.JSX.Element | null {
	const col = colById.get(condition.columnId);
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
