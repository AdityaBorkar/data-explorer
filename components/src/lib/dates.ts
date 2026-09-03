export function parseDateValue(v: unknown): Date | null {
	if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
	if (typeof v === "string" || typeof v === "number") {
		if (v === "") return null;
		const d = new Date(v);
		return Number.isNaN(d.getTime()) ? null : d;
	}
	return null;
}

export function toValidDate(value: string | undefined): Date | undefined {
	return parseDateValue(value) ?? undefined;
}
