import { useCallback, useEffect, useRef } from "react";

export function useLoadMore(
  fetchNextPage: () => void,
  hasNextPage: boolean,
  isFetchingNextPage: boolean,
  options?: { threshold?: number },
) {
  const threshold = options?.threshold ?? 200;
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<Element | null>(null);

  const triggerRef = useCallback(
    (el: Element | null) => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }

      if (!(el && hasNextPage)) {
        sentinelRef.current = null;
        return;
      }

      sentinelRef.current = el;
      observerRef.current = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (entry?.isIntersecting && hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        },
        { rootMargin: `${threshold}px` },
      );
      observerRef.current.observe(el);
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage, threshold],
  );

  useEffect(
    () => () => {
      observerRef.current?.disconnect();
    },
    [],
  );

  return { triggerRef };
}
