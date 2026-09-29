import { useEffect, useRef } from "react";

// Starts the next page a little before the end of the list comes into view.
const PREFETCH_MARGIN = "200px";

/**
 * Calls `loadMore` when the sentinel nears the viewport. Callers pass
 * `enabled: false` while a page is loading or after one failed, so a failing
 * request isn't retried in a loop just because the sentinel is still visible.
 */
export function useInfiniteScroll(
  loadMore: () => void,
  enabled: boolean,
): React.RefObject<HTMLDivElement | null> {
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!(el && enabled)) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: PREFETCH_MARGIN },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore, enabled]);
  return sentinelRef;
}
