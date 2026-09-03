import type { TableFeatures } from "@adistack/data-explorer";
import { useDataExplorerContext } from "@adistack/data-explorer";
import type { Row } from "@tanstack/react-table";

import { Checkbox } from "@/components/ui/checkbox";

interface SelectionCheckboxProps<TItem extends Record<string, unknown>> {
	row: Row<TableFeatures, TItem>;
}

export function SelectionCheckbox<TItem extends Record<string, unknown>>({
	row,
}: SelectionCheckboxProps<TItem>): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<Checkbox
				checked={row.getIsSelected()}
				onCheckedChange={() => row.toggleSelected()}
			/>
		</div>
	);
}

export function SelectAllCheckbox(): React.JSX.Element {
	const { table } = useDataExplorerContext();

	const checked = table.getIsAllRowsSelected();
	const indeterminate = table.getIsSomeRowsSelected() && !checked;

	return (
		<div className="flex items-center justify-center">
			<Checkbox
				checked={indeterminate ? "indeterminate" : checked}
				onCheckedChange={() => table.toggleAllRowsSelected(!checked)}
			/>
		</div>
	);
}
