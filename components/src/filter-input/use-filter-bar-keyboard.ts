import type { FilterCondition } from "@adistack/data-explorer";
import { useCallback, useEffect, useRef, useState } from "react";

export function useFilterBarKeyboard(opts: {
	conditions: FilterCondition[];
	inputValue: string;
	onRemove: (id: string) => void;
	popoverOpen: boolean;
	onResetFlow: () => void;
}) {
	const { conditions, inputValue, onRemove, popoverOpen, onResetFlow } = opts;
	const containerRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const [focusedChipIndex, setFocusedChipIndex] = useState<number | null>(null);

	const focusInput = useCallback(() => {
		inputRef.current?.focus();
	}, []);

	const focusChipById = useCallback(
		(id: string | undefined, action: "click" | "focus") => {
			if (!id) return;
			const chipEl = containerRef.current?.querySelector(
				`[data-filter-chip="${id}"] button:first-child`,
			);
			if (chipEl instanceof HTMLElement) {
				if (action === "click") chipEl.click();
				else chipEl.focus();
			}
		},
		[],
	);

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
				focusChipById(conditions[focusedChipIndex]?.id, "click");
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
			focusChipById,
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

	useEffect(() => {
		if (focusedChipIndex !== null) {
			focusChipById(conditions[focusedChipIndex]?.id, "focus");
		}
	}, [focusedChipIndex, conditions, focusChipById]);

	return {
		containerRef,
		focusChipById,
		focusedChipIndex,
		focusInput,
		handleInputKeyDown,
		inputRef,
		setFocusedChipIndex,
	};
}
