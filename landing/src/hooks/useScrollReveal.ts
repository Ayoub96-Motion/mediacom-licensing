import { useEffect, type RefObject } from "react";

/**
 * Fades/slides every `.reveal` element under `rootRef` into place the first
 * time it scrolls into view. One IntersectionObserver for all targets; each
 * target is unobserved once revealed. Marks targets with a data attribute
 * rather than a class so a React re-render (which owns `className`) can't
 * wipe the revealed state.
 *
 * Reduced motion is handled in CSS (the transform is dropped, the opacity
 * fade stays), so this hook doesn't need to know about it.
 */
export function useScrollReveal(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const targets = root.querySelectorAll<HTMLElement>(".reveal");

    if (!("IntersectionObserver" in window)) {
      targets.forEach((el) => (el.dataset.revealed = "true"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).dataset.revealed = "true";
          observer.unobserve(entry.target);
        }
      },
      // Positive bottom margin: fire a little before the element actually
      // crosses the fold, so the animation is underway as it appears.
      { threshold: 0.15, rootMargin: "0px 0px 48px 0px" }
    );

    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [rootRef]);
}
