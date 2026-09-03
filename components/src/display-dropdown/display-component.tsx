import { IconLayoutList } from "@tabler/icons-react";

import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";

interface DisplayComponentProps {
	children: React.ReactNode;
}

export function DisplayComponent({
	children,
}: DisplayComponentProps): React.JSX.Element {
	return (
		<Popover>
			<PopoverTrigger asChild={true}>
				<button
					aria-label="Display options"
					className="flex h-8 items-center gap-1.5 rounded-md border border-input px-2 text-muted-foreground text-sm transition-colors hover:bg-muted hover:text-foreground"
					type="button"
				>
					<IconLayoutList className="size-4" />
					<span>Display</span>
				</button>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-64 p-0" side="bottom">
				<div className="flex flex-col divide-y">{children}</div>
			</PopoverContent>
		</Popover>
	);
}
