import { useEffect, useRef } from "react";

// Attach the returned ref to a sentinel element at the bottom of a list;
// onIntersect fires once it scrolls into view, so the caller can fetch the
// next page. rootMargin gives it a head start so more loads in before the
// user actually hits the bottom.
export function useInfiniteScrollTrigger(onIntersect: () => void, enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) onIntersect(); },
      { rootMargin: "300px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [onIntersect, enabled]);

  return ref;
}
