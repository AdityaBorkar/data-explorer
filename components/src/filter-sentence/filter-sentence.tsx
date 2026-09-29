import type { FilterCondition } from "@adistack/data-explorer";
import {
	createFilter,
	getDefaultOperator,
	useDataExplorerContext,
	validateCondition,
} from "@adistack/data-explorer";
import { IconDeviceFloppy, IconPencil, IconPlus } from "@tabler/icons-react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SentenceBuilderRow } from "./builder-row.tsx";
import { SentenceView } from "./sentence-view.tsx";

/** Shared-layout glide — mirrors recruiter-mg `beui/ease` SPRING_LAYOUT. */
const SPRING_LAYOUT = {
	damping: 32,
	mass: 0.6,
	stiffness: 360,
	type: "spring",
} as const;

const MotionButton = m.create(Button);

interface FilterSentenceProps {
	className?: string;
	/** Prose subject, e.g. "Employees". Default "records". */
	subject?: string;
}

/**
 * Saved filters rendered as a plain-language sentence that morphs in place
 * into a Where/And/Or builder. Reads `table.state.dataFilters` via the
 * DataExplorer context; Edit snapshots the committed filters into a local
 * draft, and Save validates every row (`validateCondition`) before committing
 * atomically with `table.setDataFilters(draft)`. Leaving without Save is an
 * implicit discard. Requires a DataExplorer Provider ancestor.
 */
export function FilterSentence({
	className,
	subject = "records",
}: FilterSentenceProps): React.JSX.Element {
	const { columnsConfig, table } = useDataExplorerContext();
	const [advanced, setAdvanced] = useState(false);
	const [draft, setDraft] = useState<FilterCondition[]>([]);

	const reduce = useReducedMotion();
	const motionSafe = reduce ? ({ duration: 0 } as const) : SPRING_LAYOUT;
	const panelMotion = {
		animate: { opacity: 1, scale: 1, y: 0 },
		exit: { opacity: 0, scale: 0.98, y: -12 },
		initial: { opacity: 0, scale: 0.98, y: 12 },
		transition: motionSafe,
	} as const;
	const rowMotion = {
		animate: { opacity: 1, x: 0 },
		exit: { opacity: 0, transition: { duration: 0.15 }, x: -16 },
		initial: { opacity: 0, x: -16 },
		transition: motionSafe,
	} as const;

	const columnsById = useMemo(
		() => new Map(columnsConfig.map((column) => [column.id, column])),
		[columnsConfig],
	);
	const rowError = (condition: FilterCondition) =>
		validateCondition(condition, columnsById);
	const canSave = draft.every((condition) => rowError(condition) === undefined);

	const openBuilder = () => {
		// Snapshot the committed filters so leaving without Save never touches
		// `table.state`; ids are preserved so row keys stay stable.
		setDraft(table.state.dataFilters.map((condition) => ({ ...condition })));
		setAdvanced(true);
	};

	const save = () => {
		table.setDataFilters(draft);
		setAdvanced(false);
	};

	const patchCondition = (id: string, patch: Partial<FilterCondition>): void =>
		setDraft((previous) =>
			previous.map((condition) =>
				condition.id === id ? { ...condition, ...patch } : condition,
			),
		);

	const removeCondition = (id: string): void =>
		setDraft((previous) =>
			previous
				.filter((condition) => condition.id !== id)
				.map((condition, index) =>
					index === 0 && condition.combinator !== "and"
						? { ...condition, combinator: "and" }
						: condition,
				),
		);

	const addCondition = (): void => {
		const column = columnsConfig[0];
		if (!column) return;
		setDraft((previous) => [
			...previous,
			createFilter(column.id, getDefaultOperator(column.type), ""),
		]);
	};

	return (
		<m.div
			className={cn(
				"overflow-hidden rounded-lg border border-input bg-card shadow-xs",
				className,
			)}
			layout
			transition={motionSafe}
		>
			<AnimatePresence initial={false} mode="popLayout">
				{advanced ? (
					<m.div className="space-y-1.5 p-3" key="builder" {...panelMotion}>
						<AnimatePresence initial={false}>
							{draft.map((condition, index) => (
								<m.div key={condition.id} layout {...rowMotion}>
									<SentenceBuilderRow
										column={columnsById.get(condition.columnId)}
										columns={columnsConfig}
										condition={condition}
										error={rowError(condition)}
										index={index}
										onPatch={patchCondition}
										onRemove={removeCondition}
									/>
								</m.div>
							))}
						</AnimatePresence>
						<div className="flex items-center gap-2 pt-1">
							<span className="w-14" />
							<Button
								className="h-7 rounded-md border border-dashed border-border bg-transparent text-xs text-muted-foreground shadow-none hover:border-foreground/30 hover:text-foreground"
								onClick={addCondition}
								size="sm"
								variant="outline"
							>
								<IconPlus aria-hidden="true" className="size-3" />
								Add condition
							</Button>
							<MotionButton
								className="ml-auto shrink-0"
								disabled={!canSave}
								layoutId="filter-sentence-action"
								onClick={save}
								size="sm"
								variant="outline"
							>
								<IconDeviceFloppy aria-hidden="true" />
								Save
							</MotionButton>
						</div>
					</m.div>
				) : (
					<m.div
						className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
						key="sentence"
						{...panelMotion}
					>
						<SentenceView
							columnsConfig={columnsConfig}
							conditions={table.state.dataFilters}
							subject={subject}
						/>
						<MotionButton
							className="ml-auto shrink-0"
							layoutId="filter-sentence-action"
							onClick={openBuilder}
							size="sm"
							variant="outline"
						>
							<IconPencil aria-hidden="true" />
							Edit
						</MotionButton>
					</m.div>
				)}
			</AnimatePresence>
		</m.div>
	);
}
