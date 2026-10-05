import { useEffect, useState } from "react";

// Port of the MediaCom Desktop startup loading screen (intercom-app
// server-manager/renderer/index.html, .dashboard-loading): gradient "M" badge
// breathing over a soft glow, the 7-bar waveform, then the wordmark. Same
// keyframes/timing/easing — see .splash-* in styles.css.

const SESSION_KEY = "mc_splash_seen";

// One full breathe cycle of the desktop animation (loading-breathe /
// loading-glow are both 2s ease-in-out) — the splash never cuts it mid-pulse.
const MIN_VISIBLE_MS = 2000;
// Safety cap: a hung asset (slow CDN font, stalled image) must never trap
// the visitor behind the splash.
const MAX_VISIBLE_MS = 6000;
const FADE_MS = 450;

function readSeen(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false; // storage blocked (private mode etc.) — just show it
  }
}

function markSeen() {
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    // non-fatal: worst case it plays again next load
  }
}

/**
 * Resolves once web fonts and the page's images (e.g. the hero screenshots)
 * have loaded. Images are awaited individually rather than via window "load":
 * React commits the first render in a later task, so "load" can fire before
 * any <img> exists. Called from an effect, i.e. after that commit.
 */
function criticalAssetsReady(): Promise<void> {
  const fonts = document.fonts?.ready.then(() => undefined) ?? Promise.resolve();
  const images = Array.from(document.images)
    .filter((img) => !img.complete)
    .map(
      (img) =>
        new Promise<void>((resolve) => {
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true }); // a broken image shouldn't hold the splash
        })
    );
  return Promise.all([fonts, ...images]).then(() => undefined);
}

/**
 * Full-screen preloader, once per browser session. Mounted at the app root
 * (outside the router), so in-app navigation never re-mounts it; only a fresh
 * page load in a new session shows it. The page renders underneath so its
 * fonts and images load while the splash is up. Dismissal waits for whichever
 * is longer, the animation's natural duration or critical asset loading
 * (capped), then fades out before unmounting.
 */
export function LoadingSplash() {
  const [phase, setPhase] = useState<"visible" | "leaving" | "gone">(() => (readSeen() ? "gone" : "visible"));

  useEffect(() => {
    if (phase !== "visible") return;
    markSeen();
    document.documentElement.classList.add("splash-active"); // locks page scroll

    let cancelled = false;
    const minDuration = new Promise<void>((r) => setTimeout(r, MIN_VISIBLE_MS));
    const ready = Promise.race([criticalAssetsReady(), new Promise<void>((r) => setTimeout(r, MAX_VISIBLE_MS))]);
    Promise.all([minDuration, ready]).then(() => {
      if (!cancelled) setPhase("leaving");
    });
    return () => {
      cancelled = true;
    };
    // Runs once for the initial "visible" phase only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== "leaving") return;
    // Release scroll and the pre-JS dark background (index.html) as the fade starts.
    document.documentElement.classList.remove("splash-active", "splash-pending");
    const t = setTimeout(() => setPhase("gone"), FADE_MS);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    // Returning visitor this session: make sure the pre-JS dark background is cleared.
    if (phase === "gone") document.documentElement.classList.remove("splash-active", "splash-pending");
  }, [phase]);

  if (phase === "gone") return null;

  return (
    <div className={`splash${phase === "leaving" ? " is-leaving" : ""}`} role="status" aria-live="polite" aria-label="Loading MediaCom">
      <div className="splash-logo-wrap">
        <div className="splash-logo">M</div>
      </div>
      <div className="splash-wave" aria-hidden="true">
        {[14, 24, 32, 20, 28, 16, 22].map((h, i) => (
          <span key={i} style={{ height: h, animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
      <div className="splash-wordmark">MediaCom</div>
    </div>
  );
}
