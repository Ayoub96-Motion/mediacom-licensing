import { useEffect, useRef } from "react";
import { Nav } from "../components/Nav";
import { Hero } from "../components/Hero";
import { CtaBand, Features, HowItWorks, Pricing } from "../components/Sections";
import { Footer } from "../components/Footer";
import { useScrollReveal } from "../hooks/useScrollReveal";

export function LandingPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  useScrollReveal(rootRef);

  // Arriving on /#pricing etc. from another page: the browser tried to jump
  // to the anchor before React rendered it, so do it once content exists.
  useEffect(() => {
    if (window.location.hash) {
      document.getElementById(window.location.hash.slice(1))?.scrollIntoView();
    }
  }, []);

  return (
    <div ref={rootRef}>
      <Nav />
      <Hero />
      <HowItWorks />
      <Features />
      <Pricing />
      <CtaBand />
      <Footer />
    </div>
  );
}
