import { useCallback, useEffect, useRef } from "react";

export function useLoadMore(
	fetchNextPage: () => void,
	hasNextPage: boolean,
	isFetchingNextPage: boolean,
	options?: { threshold?: number },
) {
	const threshold = options?.threshold ?? 200;
	const observerRef = useRef<IntersectionObserver | null>(null);
	const flagsRef = useRef({ fetchNextPage, hasNextPage, isFetchingNextPage });
	flagsRef.current = { fetchNextPage, hasNextPage, isFetchingNextPage };

	const triggerRef = useCallback(
		(el: Element | null) => {
			if (observerRef.current) {
				observerRef.current.disconnect();
				observerRef.current = null;
			}

			if (!el) return;

			observerRef.current = new IntersectionObserver(
				(entries) => {
					const entry = entries[0];
					const flags = flagsRef.current;
					if (
						entry?.isIntersecting &&
						flags.hasNextPage &&
						!flags.isFetchingNextPage
					) {
						flags.fetchNextPage();
					}
				},
				{ rootMargin: `${threshold}px`, threshold: 0 },
			);
			observerRef.current.observe(el);
		},
		[threshold],
	);

	useEffect(
		() => () => {
			observerRef.current?.disconnect();
			observerRef.current = null;
		},
		[],
	);

	return { triggerRef };
}
