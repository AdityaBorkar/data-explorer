import { useDataExplorerContext } from "@adistack/data-explorer";
import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import { parseDateValue } from "../filter-input/value-input.tsx";

type ZoomLevel = "day" | "week" | "month";

const ZOOM_CONFIG: Record<
	ZoomLevel,
	{ dayWidth: number; segmentDays: number; prefix: string }
> = {
	day: { dayWidth: 40, prefix: "D", segmentDays: 1 },
	month: { dayWidth: 8, prefix: "M", segmentDays: 30 },
	week: { dayWidth: 20, prefix: "W", segmentDays: 7 },
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;

interface TimelineViewProps<TItem> {
	getRowId: (item: TItem) => string;
	renderBar?: (
		item: TItem,
		meta: { width: number; left: number },
	) => React.ReactNode;
}

export function TimelineView<TItem>({
	renderBar,
	getRowId,
}: TimelineViewProps<TItem>) {
	const {
		data: { items },
		columnsConfig,
	} = useDataExplorerContext<TItem>();
	const [zoom, setZoom] = useState<ZoomLevel>("week");

	const startCol = useMemo(
		() => columnsConfig.find((c) => c.startOf === "timeline"),
		[columnsConfig],
	);
	const endCol = useMemo(
		() => columnsConfig.find((c) => c.endOf === "timeline"),
		[columnsConfig],
	);

	const { range, items: timelineItems } = useMemo(() => {
		if (!(startCol && endCol))
			return { items: [], range: { end: new Date(), start: new Date() } };

		const parsed = items.map((item) => {
			const rec = item as unknown as Record<string, unknown>;
			const start = parseDateValue(rec[startCol.id]);
			const end = parseDateValue(rec[endCol.id]);
			return { end, item, start };
		});

		const withDates = parsed.filter(
			(p): p is { end: Date; item: TItem; start: Date } =>
				p.start !== null && p.end !== null,
		);
		const milestones = parsed.filter(
			(p): p is { end: Date | null; item: TItem; start: Date } =>
				p.start !== null && p.end === null,
		);

		const allDates = [
			...withDates.flatMap((p) => [p.start, p.end]),
			...milestones.map((p) => p.start),
		];
		if (allDates.length === 0)
			return { items: [], range: { end: new Date(), start: new Date() } };

		let minTime = allDates[0]?.getTime() ?? 0;
		let maxTime = minTime;
		for (const d of allDates) {
			const t = d.getTime();
			if (t < minTime) minTime = t;
			if (t > maxTime) maxTime = t;
		}

		const start = new Date(minTime);
		start.setDate(start.getDate() - 7);
		const end = new Date(maxTime);
		end.setDate(end.getDate() + 7);

		const timelineItems = [
			...withDates.map((p) => ({
				end: p.end,
				isMilestone: false,
				item: p.item,
				start: p.start,
			})),
			...milestones.map((p) => ({
				end: p.start,
				isMilestone: true,
				item: p.item,
				start: p.start,
			})),
		];

		return { items: timelineItems, range: { end, start } };
	}, [items, startCol, endCol]);

	const totalDays = Math.ceil(
		(range.end.getTime() - range.start.getTime()) / MS_PER_DAY,
	);
	const { dayWidth, segmentDays, prefix } = ZOOM_CONFIG[zoom];
	const segmentCount = Math.ceil(totalDays / segmentDays);
	const rangeStart = range.start.getTime();

	function getPosition(date: Date): number {
		const days = (date.getTime() - rangeStart) / MS_PER_DAY;
		return days * dayWidth;
	}

	if (!(startCol && endCol)) {
		return (
			<div className="flex h-full items-center justify-center text-muted-foreground text-sm">
				Timeline requires startOf and endOf columns
			</div>
		);
	}

	return (
		<div className="flex h-full flex-col">
			<div className="flex items-center gap-2 border-b px-4 py-2">
				<span className="font-medium text-sm">Timeline</span>
				<div className="ml-auto flex gap-1">
					{(["day", "week", "month"] as const).map((z) => (
						<button
							className={cn(
								"rounded-md px-2 py-1 text-xs transition-colors",
								zoom === z
									? "bg-primary text-primary-foreground"
									: "text-muted-foreground hover:bg-muted",
							)}
							key={z}
							onClick={() => setZoom(z)}
							type="button"
						>
							{z}
						</button>
					))}
				</div>
			</div>
			<div className="flex-1 overflow-auto">
				<div style={{ minWidth: "100%", width: totalDays * dayWidth }}>
					<div className="sticky top-0 z-10 flex h-8 border-b bg-card">
						{Array.from({ length: segmentCount }, (_, i) => (
							<div
								className="flex shrink-0 items-center border-r px-1 text-muted-foreground text-xs"
								// biome-ignore lint/suspicious/noArrayIndexKey: segments are a fixed positional sequence that never reorders
								key={i}
								style={{ width: segmentDays * dayWidth }}
							>
								{prefix}
								{i + 1}
							</div>
						))}
					</div>
					{timelineItems.map((tl) => {
						const id = getRowId(tl.item);
						const left = getPosition(tl.start);
						const width = tl.isMilestone
							? 8
							: Math.max(getPosition(tl.end) - left, dayWidth);
						return (
							<div
								className="relative flex h-10 items-center border-b"
								key={id}
							>
								{renderBar ? (
									renderBar(tl.item, { left, width })
								) : (
									<div
										className={cn(
											"absolute h-6 rounded",
											tl.isMilestone
												? "w-2 rotate-45 bg-primary"
												: "bg-primary/70",
										)}
										style={{ left, width: tl.isMilestone ? 8 : width }}
									/>
								)}
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}
