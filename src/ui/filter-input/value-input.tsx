import { IconChevronDown } from "@tabler/icons-react";
import { useState } from "react";

import { operatorSkipsValue } from "../../core/features/data-filtering/operators.ts";
import type { ColumnConfig, FilterOperator } from "../../core/types.ts";
import { SEARCH_COLUMN_ID } from "../../core/types.ts";
import {
  Calendar,
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

export function ValueInput({
  column,
  operator,
  value,
  onChange,
  onCommit,
}: ValueInputProps) {
  if (operatorSkipsValue(operator)) {
    return null;
  }

  if (column.id === SEARCH_COLUMN_ID) {
    return (
      <StringInput
        onChange={onChange}
        onCommit={onCommit}
        placeholder="Search..."
        value={value as string}
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
          value={value as string}
        />
      );
    case "number":
      if (operator === "between" || operator === "notBetween") {
        return (
          <NumberRangeInput
            onChange={onChange}
            value={value as [number, number] | undefined}
          />
        );
      }
      return (
        <NumberInput
          onChange={onChange}
          onCommit={onCommit}
          value={value as number | undefined}
        />
      );
    case "date":
      if (operator === "between" || operator === "notBetween") {
        return (
          <DateRangeInput
            onChange={onChange}
            value={value as [string, string] | undefined}
          />
        );
      }
      return (
        <DateInput onChange={onChange} value={value as string | undefined} />
      );
    case "boolean":
      return (
        <BooleanInput
          onChange={onChange}
          value={value as boolean | undefined}
        />
      );
    case "enum":
    case "multiEnum":
      return null;
    default:
      return (
        <StringInput
          onChange={onChange}
          onCommit={onCommit}
          placeholder="Value..."
          value={value as string}
        />
      );
  }
}

function StringInput({
  value,
  onChange,
  onCommit,
  placeholder,
}: {
  value: string;
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
        const v = e.target.value;
        onChange(v === "" ? undefined : Number(v));
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
          const v = e.target.value;
          onChange([v === "" ? undefined : Number(v), max]);
        }}
        placeholder="Min"
        type="number"
        value={min ?? ""}
      />
      <span className="text-muted-foreground text-xs">and</span>
      <Input
        className="h-8 text-sm"
        onChange={(e) => {
          const v = e.target.value;
          onChange([min, v === "" ? undefined : Number(v)]);
        }}
        placeholder="Max"
        type="number"
        value={max ?? ""}
      />
    </div>
  );
}

function DateInput({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (v: unknown) => void;
}) {
  const [open, setOpen] = useState(false);
  const dateValue = value ? new Date(value) : undefined;

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
  const fromValue = from ? new Date(from) : undefined;
  const toValue = to ? new Date(to) : undefined;

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
      <span className="text-sm">{value ? "Yes" : "No"}</span>
    </div>
  );
}
