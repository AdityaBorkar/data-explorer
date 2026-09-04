import type { FilterCondition } from "@adistack/data-explorer";
import { useCallback, useEffect, useRef, useState } from "react";

interface FilterBarKeyboardOptions {
	conditions: FilterCondition[];
	inputValue: string;
	onRemove: (id: string) => void;
	onResetFlow: () => void;
	popoverOpen: boolean;
}

interface FilterBarKeyboard {
	containerRef: React.RefObject<HTMLDivElement | null>;
	focusedChipIndex: number | null;
	focusInput: () => void;
	handleInputKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
	inputRef: React.RefObject<HTMLInputElement | null>;
	setFocusedChipIndex: (index: number | null) => void;
}

function focusChip(
	container: HTMLDivElement | null,
	id: string | undefined,
	action: "click" | "focus",
): void {
	if (!(container && id)) return;
	const chipEl = container.querySelector(
		`[data-filter-chip="${id}"] button:first-child`,
	);
	if (chipEl instanceof HTMLElement) {
		if (action === "click") chipEl.click();
		else chipEl.focus();
	}
}

export function useFilterBarKeyboard(
	opts: FilterBarKeyboardOptions,
): FilterBarKeyboard {
	const { conditions, inputValue, onRemove, popoverOpen, onResetFlow } = opts;
	const containerRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const [focusedChipIndex, setFocusedChipIndex] = useState<number | null>(null);

	const focusInput = useCallback(() => {
		inputRef.current?.focus();
	}, []);

	const handleInputKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLInputElement>) => {
			if (e.key === "ArrowLeft") {
				const target = e.currentTarget;
				if (
					target.selectionStart === 0 &&
					target.selectionEnd === 0 &&
					conditions.length > 0
				) {
					e.preventDefault();
					const newIdx =
						focusedChipIndex === null
							? conditions.length - 1
							: Math.max(0, focusedChipIndex - 1);
					setFocusedChipIndex(newIdx);
					return;
				}
			}

			if (e.key === "ArrowRight" && focusedChipIndex !== null) {
				e.preventDefault();
				if (focusedChipIndex < conditions.length - 1) {
					setFocusedChipIndex(focusedChipIndex + 1);
				} else {
					setFocusedChipIndex(null);
					focusInput();
				}
				return;
			}

			if (
				(e.key === "Backspace" || e.key === "Delete") &&
				focusedChipIndex !== null
			) {
				e.preventDefault();
				const cond = conditions[focusedChipIndex];
				if (cond) {
					onRemove(cond.id);
					if (conditions.length <= 1) {
						setFocusedChipIndex(null);
						focusInput();
					} else if (focusedChipIndex >= conditions.length - 1) {
						setFocusedChipIndex(conditions.length - 2);
					}
				}
				return;
			}

			if (
				e.key === "Backspace" &&
				inputValue === "" &&
				conditions.length > 0 &&
				focusedChipIndex === null
			) {
				e.preventDefault();
				setFocusedChipIndex(conditions.length - 1);
				return;
			}

			if (e.key === "Enter" && focusedChipIndex !== null) {
				e.preventDefault();
				focusChip(
					containerRef.current,
					conditions[focusedChipIndex]?.id,
					"click",
				);
				return;
			}

			if (e.key === "Escape") {
				if (popoverOpen) {
					onResetFlow();
					focusInput();
					return;
				}
				setFocusedChipIndex(null);
				return;
			}

			if (focusedChipIndex !== null && e.key.length === 1) {
				setFocusedChipIndex(null);
			}
		},
		[
			conditions,
			onRemove,
			focusedChipIndex,
			inputValue,
			popoverOpen,
			onResetFlow,
			focusInput,
		],
	);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.ctrlKey || e.metaKey) && e.key === "f") {
				e.preventDefault();
				inputRef.current?.focus();
				setFocusedChipIndex(null);
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, []);

	const focusedId =
		focusedChipIndex !== null ? conditions[focusedChipIndex]?.id : undefined;

	useEffect(() => {
		if (focusedChipIndex !== null) {
			focusChip(containerRef.current, focusedId, "focus");
		}
	}, [focusedChipIndex, focusedId]);

	return {
		containerRef,
		focusedChipIndex,
		focusInput,
		handleInputKeyDown,
		inputRef,
		setFocusedChipIndex,
	};
}
