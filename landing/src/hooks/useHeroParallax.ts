import { useEffect, type RefObject } from "react";
import { prefersReducedMotion } from "./motion";

const LAPTOP_RATE = 0.08;
const PHONE_RATE = 0.15;

/**
 * Scroll parallax for the hero's device mockups: the phone (foreground)
 * moves faster than the laptop behind it. The scroll listener only exists
 * while the hero is actually on screen (attached/detached by an
 * IntersectionObserver), and is rAF-throttled to one transform write per
 * frame. Writes go straight to element.style — no React state, no re-render.
 */
export function useHeroParallax(
  heroRef: RefObject<HTMLElement | null>,
  laptopRef: RefObject<HTMLElement | null>,
  phoneRef: RefObject<HTMLElement | null>
) {
  useEffect(() => {
    const hero = heroRef.current;
    const laptop = laptopRef.current;
    const phone = phoneRef.current;
    if (!hero || !laptop || !phone || !("IntersectionObserver" in window)) return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let listening = false;
    let heroVisible = false;

    function apply() {
      frame = 0;
      const y = window.scrollY;
      laptop!.style.transform = `translate3d(0, ${(-y * LAPTOP_RATE).toFixed(1)}px, 0)`;
      phone!.style.transform = `translate3d(0, ${(-y * PHONE_RATE).toFixed(1)}px, 0)`;
    }

    function onScroll() {
      if (!frame) frame = requestAnimationFrame(apply);
    }

    function sync() {
      const shouldListen = heroVisible && !prefersReducedMotion();
      if (shouldListen && !listening) {
        window.addEventListener("scroll", onScroll, { passive: true });
        listening = true;
        onScroll();
      } else if (!shouldListen && listening) {
        window.removeEventListener("scroll", onScroll);
        listening = false;
      }
      if (prefersReducedMotion()) {
        laptop!.style.transform = "";
        phone!.style.transform = "";
      }
    }

    const observer = new IntersectionObserver(([entry]) => {
      heroVisible = entry.isIntersecting;
      sync();
    });
    observer.observe(hero);
    motionQuery.addEventListener("change", sync);

    return () => {
      observer.disconnect();
      motionQuery.removeEventListener("change", sync);
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [heroRef, laptopRef, phoneRef]);
}
