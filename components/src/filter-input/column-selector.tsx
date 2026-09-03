import type { ColumnConfig } from "@adistack/data-explorer";
import { isSearchColumn } from "@adistack/data-explorer";
import { useMemo } from "react";

import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";

interface ColumnSelectorProps {
	columns: ColumnConfig[];
	onQuickValueSelect?: (columnId: string, value: string) => void;
	onSearchChange: (value: string) => void;
	onSelect: (columnId: string) => void;
	search: string;
}

export function ColumnSelector({
	columns,
	search,
	onSearchChange,
	onSelect,
	onQuickValueSelect,
}: ColumnSelectorProps): React.JSX.Element {
	const term = search.trim().toLowerCase();
	const filteredColumns = useMemo(() => {
		if (!term) return columns;
		return columns.filter(
			(c) =>
				c.displayName.toLowerCase().includes(term) ||
				c.id.toLowerCase().includes(term),
		);
	}, [columns, term]);

	const quickMatches = useMemo(() => {
		if (term.length < 2) return [];
		const matches: {
			columnId: string;
			columnDisplayName: string;
			option: { label: string; value: string };
		}[] = [];

		for (const col of columns) {
			if (col.type !== "enum" && col.type !== "multiEnum") continue;
			const opts = col.options ?? [];
			for (const opt of opts) {
				if (
					opt.label.toLowerCase().includes(term) ||
					opt.value.toLowerCase().includes(term)
				) {
					matches.push({
						columnDisplayName: col.displayName,
						columnId: col.id,
						option: opt,
					});
				}
			}
		}
		return matches;
	}, [term, columns]);

	return (
		<Command
			filter={(value, query) =>
				value.toLowerCase().includes(query.toLowerCase()) ? 1 : 0
			}
			loop={true}
		>
			<CommandInput
				onValueChange={onSearchChange}
				placeholder="Filter columns..."
				value={search}
			/>
			<CommandEmpty>No columns found</CommandEmpty>
			<CommandList className="max-h-64">
				<CommandGroup heading="Columns">
					{filteredColumns.map((col) => {
						const Icon = col.icon as
							| React.ComponentType<{
									className?: string;
									strokeWidth?: number;
							  }>
							| undefined;
						return (
							<CommandItem
								key={col.id}
								keywords={[col.displayName]}
								onSelect={() => onSelect(col.id)}
								value={col.id}
							>
								<div className="flex w-full items-center gap-1.5">
									{!!Icon && (
										<Icon className="size-4 shrink-0" strokeWidth={2.25} />
									)}
									<span>{col.displayName}</span>
									{isSearchColumn(col) && (
										<span className="ml-auto text-muted-foreground text-xs">
											Search all
										</span>
									)}
								</div>
							</CommandItem>
						);
					})}
				</CommandGroup>
				{quickMatches.length > 0 && (
					<CommandGroup heading="Quick values">
						{quickMatches.map((m) => (
							<CommandItem
								key={`${m.columnId}-${m.option.value}`}
								keywords={[m.option.label, m.columnDisplayName]}
								onSelect={() =>
									onQuickValueSelect?.(m.columnId, m.option.value)
								}
								value={`${m.columnId}-${m.option.value}`}
							>
								<div className="flex items-center gap-1.5">
									<span className="text-muted-foreground">
										{m.columnDisplayName}
									</span>
									<span className="text-muted-foreground/75">&rarr;</span>
									<span>{m.option.label}</span>
								</div>
							</CommandItem>
						))}
					</CommandGroup>
				)}
			</CommandList>
		</Command>
	);
}
