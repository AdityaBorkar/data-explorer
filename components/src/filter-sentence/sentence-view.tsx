import type { ColumnConfig, FilterCondition } from "@adistack/data-explorer";
import {
	formatFilterValue,
	getOperatorArity,
	getOperatorLabel,
} from "@adistack/data-explorer";

import { cn } from "@/lib/utils";

interface SentenceViewProps {
	columnsConfig: ColumnConfig[];
	conditions: FilterCondition[];
	/** Prose subject, e.g. "Employees". Default "records". */
	subject: string;
}

function Term({
	children,
	className,
}: {
	children: React.ReactNode;
	className?: string;
}): React.JSX.Element {
	return (
		<span
			className={cn(
				"rounded bg-muted/80 px-1.5 py-0.5 font-medium text-foreground",
				className,
			)}
		>
			{children}
		</span>
	);
}

/**
 * Prose rendering of committed filters: "Tasks whose <status> <is> <todo>
 * and <priority> <is> <high>". A faithful view of `table.state.dataFilters` —
 * unknown columns and stale conditions render degraded (raw id, muted chip),
 * never filtered out or thrown on.
 */
export function SentenceView({
	columnsConfig,
	conditions,
	subject,
}: SentenceViewProps): React.JSX.Element {
	return (
		<p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm leading-relaxed text-muted-foreground">
			{conditions.length === 0 ? (
				<span className="italic">
					No conditions yet — pick Edit to add one.
				</span>
			) : (
				<>
					<span>{subject}</span>
					{conditions.map((condition, index) => {
						const column = columnsConfig.find(
							(candidate) => candidate.id === condition.columnId,
						);
						const displayValue = formatFilterValue(
							condition.value,
							condition.operator,
							column ?? { type: "string" },
						);
						return (
							<span
								className="inline-flex items-center gap-1 whitespace-nowrap"
								key={condition.id}
							>
								{index === 0 ? "whose" : condition.combinator}
								<Term className={column ? undefined : "text-muted-foreground"}>
									{column ? column.displayName : condition.columnId}
								</Term>
								<Term>{getOperatorLabel(condition.operator)}</Term>
								{displayValue !== null ? (
									<Term>{displayValue}</Term>
								) : getOperatorArity(condition.operator) ===
									"nullary" ? null : (
									<Term className="font-normal text-muted-foreground italic">
										any value
									</Term>
								)}
							</span>
						);
					})}
				</>
			)}
		</p>
	);
}
