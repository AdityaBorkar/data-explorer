import { IconChevronDown } from "@tabler/icons-react";
import { useState } from "react";

import { editorKind } from "../../core/features/data-filtering/filter-draft.ts";
import type { ColumnConfig, FilterOperator } from "../../core/types.ts";
import {
	Calendar,
	Checkbox,
	Input,
	Popover,
	PopoverContent,
	PopoverTrigger,
	Switch,
} from "../primitives/index.ts";

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
}: ValueInputProps) {
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

function StringInput({
	value,
	onChange,
	onCommit,
	placeholder,
}: {
	value: string | undefined;
	onChange: (v: unknown) => void;
	onCommit: () => void;
	placeholder: string;
}) {
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
}: {
	value: number | undefined;
	onChange: (v: unknown) => void;
	onCommit: () => void;
}) {
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
}: {
	value: [number, number] | undefined;
	onChange: (v: unknown) => void;
}) {
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

export function toValidDate(value: string | undefined): Date | undefined {
	if (!value) return undefined;
	const d = new Date(value);
	return Number.isNaN(d.getTime()) ? undefined : d;
}

export function parseDateValue(v: unknown): Date | null {
	if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
	if (typeof v === "string" || typeof v === "number") {
		if (v === "") return null;
		const d = new Date(v);
		return Number.isNaN(d.getTime()) ? null : d;
	}
	return null;
}

function DateInput({
	value,
	onChange,
}: {
	value: string | undefined;
	onChange: (v: unknown) => void;
}) {
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
}: {
	value: [string, string] | undefined;
	onChange: (v: unknown) => void;
}) {
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
}: {
	value: boolean | undefined;
	onChange: (v: unknown) => void;
}) {
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
}: {
	column: ColumnConfig;
	value: string | undefined;
	onChange: (v: unknown) => void;
	onCommit: () => void;
}) {
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
}: {
	column: ColumnConfig;
	value: unknown;
	onChange: (v: unknown) => void;
	onCommit: () => void;
}) {
	const options = column.options ?? [];
	const selected = new Set(Array.isArray(value) ? value.map(String) : []);

	function toggle(optValue: string) {
		const next = new Set(selected);
		if (next.has(optValue)) next.delete(optValue);
		else next.add(optValue);
		onChange([...next]);
	}

	if (options.length === 0) {
		return (
			<StringInput
				onChange={(v) => {
					const str = String(v ?? "");
					onChange(
						str === ""
							? []
							: str
									.split(",")
									.map((s) => s.trim())
									.filter(Boolean),
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
