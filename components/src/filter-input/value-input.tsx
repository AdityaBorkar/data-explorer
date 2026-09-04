import type { ColumnConfig, FilterOperator } from "@adistack/data-explorer";
import { editorKind } from "@adistack/data-explorer";
import { IconChevronDown } from "@tabler/icons-react";
import { useState } from "react";

import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { toValidDate } from "@/lib/dates";

export { parseDateValue, toValidDate } from "@/lib/dates";

interface ValueInputProps {
	column: ColumnConfig;
	onChange: (value: unknown) => void;
	onCommit: () => void;
	operator: FilterOperator;
	value: unknown;
}

function toNumberOrUndefined(raw: string): number | undefined {
	if (raw === "") return undefined;
	const n = Number(raw);
	return Number.isNaN(n) ? undefined : n;
}

export function ValueInput({
	column,
	operator,
	value,
	onChange,
	onCommit,
}: ValueInputProps): React.JSX.Element | null {
	const kind = editorKind(operator, column);

	if (kind === "nullary") {
		return null;
	}

	if (kind === "search") {
		return (
			<StringInput
				onChange={onChange}
				onCommit={onCommit}
				placeholder="Search..."
				value={typeof value === "string" ? value : undefined}
			/>
		);
	}

	if (kind === "multi") {
		return (
			<MultiOptionInput
				column={column}
				onChange={onChange}
				onCommit={onCommit}
				value={value}
			/>
		);
	}

	switch (column.type) {
		case "string":
			return (
				<StringInput
					onChange={onChange}
					onCommit={onCommit}
					placeholder="Value..."
					value={typeof value === "string" ? value : undefined}
				/>
			);
		case "number":
			if (operator === "between" || operator === "notBetween") {
				return (
					<NumberRangeInput
						onChange={onChange}
						value={
							Array.isArray(value) ? (value as [number, number]) : undefined
						}
					/>
				);
			}
			return (
				<NumberInput
					onChange={onChange}
					onCommit={onCommit}
					value={typeof value === "number" ? value : undefined}
				/>
			);
		case "date":
			if (operator === "between" || operator === "notBetween") {
				return (
					<DateRangeInput
						onChange={onChange}
						value={
							Array.isArray(value) ? (value as [string, string]) : undefined
						}
					/>
				);
			}
			return (
				<DateInput
					onChange={onChange}
					value={typeof value === "string" ? value : undefined}
				/>
			);
		case "boolean":
			return (
				<BooleanInput
					onChange={onChange}
					value={typeof value === "boolean" ? value : undefined}
				/>
			);
		case "enum":
			return (
				<SingleOptionInput
					column={column}
					onChange={onChange}
					onCommit={onCommit}
					value={typeof value === "string" ? value : undefined}
				/>
			);
		case "multiEnum":
			return (
				<MultiOptionInput
					column={column}
					onChange={onChange}
					onCommit={onCommit}
					value={value}
				/>
			);
		default:
			throw new Error(`Unhandled column type: ${String(column.type)}`);
	}
}

interface StringInputProps {
	onChange: (v: unknown) => void;
	onCommit: () => void;
	placeholder: string;
	value: string | undefined;
}

interface NumberInputProps {
	onChange: (v: unknown) => void;
	onCommit: () => void;
	value: number | undefined;
}

interface NumberRangeInputProps {
	onChange: (v: unknown) => void;
	value: [number, number] | undefined;
}

interface DateInputProps {
	onChange: (v: unknown) => void;
	value: string | undefined;
}

interface DateRangeInputProps {
	onChange: (v: unknown) => void;
	value: [string, string] | undefined;
}

interface BooleanInputProps {
	onChange: (v: unknown) => void;
	value: boolean | undefined;
}

interface SingleOptionInputProps {
	column: ColumnConfig;
	onChange: (v: unknown) => void;
	onCommit: () => void;
	value: string | undefined;
}

interface MultiOptionInputProps {
	column: ColumnConfig;
	onChange: (v: unknown) => void;
	onCommit: () => void;
	value: unknown;
}

function StringInput({
	value,
	onChange,
	onCommit,
	placeholder,
}: StringInputProps): React.JSX.Element {
	return (
		<Input
			autoFocus={true}
			className="h-8 text-sm"
			onChange={(e) => onChange(e.target.value)}
			onKeyDown={(e) => {
				if (e.key === "Enter") onCommit();
			}}
			placeholder={placeholder}
			value={value ?? ""}
		/>
	);
}

function NumberInput({
	value,
	onChange,
	onCommit,
}: NumberInputProps): React.JSX.Element {
	return (
		<Input
			autoFocus={true}
			className="h-8 text-sm"
			onChange={(e) => {
				onChange(toNumberOrUndefined(e.target.value));
			}}
			onKeyDown={(e) => {
				if (e.key === "Enter") onCommit();
			}}
			placeholder="Number..."
			type="number"
			value={value ?? ""}
		/>
	);
}

function NumberRangeInput({
	value,
	onChange,
}: NumberRangeInputProps): React.JSX.Element {
	const [min, max] = value ?? [undefined, undefined];
	return (
		<div className="flex items-center gap-1">
			<Input
				autoFocus={true}
				className="h-8 text-sm"
				onChange={(e) => {
					onChange([toNumberOrUndefined(e.target.value), max]);
				}}
				placeholder="Min"
				type="number"
				value={min ?? ""}
			/>
			<span className="text-muted-foreground text-xs">and</span>
			<Input
				className="h-8 text-sm"
				onChange={(e) => {
					onChange([min, toNumberOrUndefined(e.target.value)]);
				}}
				placeholder="Max"
				type="number"
				value={max ?? ""}
			/>
		</div>
	);
}

function DateInput({ value, onChange }: DateInputProps): React.JSX.Element {
	const [open, setOpen] = useState(false);
	const dateValue = toValidDate(value);

	return (
		<Popover onOpenChange={setOpen} open={open}>
			<PopoverTrigger asChild={true}>
				<button
					className="inline-flex h-8 items-center gap-1.5 rounded-md border px-2 text-sm"
					type="button"
				>
					<span className={value ? "" : "text-muted-foreground"}>
						{value ?? "Pick a date..."}
					</span>
					<IconChevronDown className="size-3.5 text-muted-foreground" />
				</button>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-auto p-0">
				<Calendar
					mode="single"
					onSelect={(d) => {
						if (d) {
							onChange(d.toISOString().split("T")[0]);
						}
						setOpen(false);
					}}
					selected={dateValue}
				/>
			</PopoverContent>
		</Popover>
	);
}

function DateRangeInput({
	value,
	onChange,
}: DateRangeInputProps): React.JSX.Element {
	const [open, setOpen] = useState(false);
	const [from, to] = value ?? [undefined, undefined];
	const fromValue = toValidDate(from);
	const toValue = toValidDate(to);

	return (
		<Popover onOpenChange={setOpen} open={open}>
			<PopoverTrigger asChild={true}>
				<button
					className="inline-flex h-8 items-center gap-1.5 rounded-md border px-2 text-sm"
					type="button"
				>
					<span className={from ? "" : "text-muted-foreground"}>
						{from ?? "From..."}
					</span>
					<span className="text-muted-foreground">–</span>
					<span className={to ? "" : "text-muted-foreground"}>
						{to ?? "To..."}
					</span>
					<IconChevronDown className="size-3.5 text-muted-foreground" />
				</button>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-auto p-0">
				<Calendar
					mode="range"
					onSelect={(range) => {
						const f = range?.from
							? range.from.toISOString().split("T")[0]
							: undefined;
						const t = range?.to
							? range.to.toISOString().split("T")[0]
							: undefined;
						if (f && t) {
							onChange([f, t]);
							setOpen(false);
						} else {
							onChange([f ?? "", t ?? ""]);
						}
					}}
					selected={
						fromValue && toValue ? { from: fromValue, to: toValue } : undefined
					}
				/>
			</PopoverContent>
		</Popover>
	);
}

function BooleanInput({
	value,
	onChange,
}: BooleanInputProps): React.JSX.Element {
	return (
		<div className="flex items-center gap-2">
			<Switch
				checked={value ?? false}
				onCheckedChange={(checked) => onChange(checked)}
			/>
			<span className="text-sm">
				{value === undefined ? "Select value..." : value ? "Yes" : "No"}
			</span>
		</div>
	);
}

function SingleOptionInput({
	column,
	value,
	onChange,
	onCommit,
}: SingleOptionInputProps): React.JSX.Element {
	const options = column.options ?? [];
	if (options.length === 0) {
		return (
			<StringInput
				onChange={onChange}
				onCommit={onCommit}
				placeholder="Value..."
				value={value}
			/>
		);
	}
	return (
		<div className="flex flex-col gap-1">
			{options.map((opt) => (
				<button
					className={
						value === opt.value
							? "rounded-md bg-muted px-2 py-1 text-left text-sm font-medium"
							: "rounded-md px-2 py-1 text-left text-sm hover:bg-muted/50"
					}
					key={opt.value}
					onClick={() => onChange(opt.value)}
					type="button"
				>
					{opt.label}
				</button>
			))}
		</div>
	);
}

function MultiOptionInput({
	column,
	value,
	onChange,
	onCommit,
}: MultiOptionInputProps): React.JSX.Element {
	const options = column.options ?? [];
	const selected = new Set(Array.isArray(value) ? value.map(String) : []);

	const toggle = (optValue: string): void => {
		const next = new Set(selected);
		if (next.has(optValue)) next.delete(optValue);
		else next.add(optValue);
		onChange([...next]);
	};

	if (options.length === 0) {
		return (
			<StringInput
				onChange={(v) => {
					const str = String(v ?? "");
					onChange(
						str === ""
							? []
							: str.split(",").flatMap((s) => {
									const trimmed = s.trim();
									return trimmed ? [trimmed] : [];
								}),
					);
				}}
				onCommit={onCommit}
				placeholder="a, b, c..."
				value={Array.isArray(value) ? value.join(", ") : undefined}
			/>
		);
	}

	return (
		<div className="flex flex-col gap-1">
			{options.map((opt) => (
				<button
					className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-muted/50"
					key={opt.value}
					onClick={() => toggle(opt.value)}
					type="button"
				>
					<Checkbox
						checked={selected.has(opt.value)}
						onCheckedChange={() => toggle(opt.value)}
						tabIndex={-1}
					/>
					<span>{opt.label}</span>
				</button>
			))}
		</div>
	);
}
