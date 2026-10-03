import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Logo } from "./Logo";

/**
 * Transparent over the dark hero; turns into a solid dark bar once the page
 * scrolls past the top (the light sections below would otherwise sit under
 * white nav text). Driven by an IntersectionObserver on a sentinel at the
 * top of the page, not a scroll listener.
 */
export function Nav() {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [solid, setSolid] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(([entry]) => setSolid(!entry.isIntersecting));
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div ref={sentinelRef} className="nav-sentinel" aria-hidden="true" />
      <header className="nav" data-solid={solid || undefined}>
        <div className="container nav-inner">
          <Logo />
          <nav className="nav-links" aria-label="Sections">
            <a href="#features">Features</a>
            <a href="#how-it-works">How it works</a>
            <a href="#pricing">Pricing</a>
          </nav>
          <div className="nav-actions">
            <Link to="/login" className="btn btn-outline btn-sm">Log in</Link>
            <Link to="/signup" className="btn btn-gradient btn-sm">Get started</Link>
          </div>
        </div>
      </header>
    </>
  );
}
