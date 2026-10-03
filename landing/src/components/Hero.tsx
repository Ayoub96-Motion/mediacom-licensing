import { useRef } from "react";
import { Link } from "react-router-dom";
import { useHeroParallax } from "../hooks/useHeroParallax";

const WAVE_BARS = [14, 24, 32, 20, 28, 16, 22];

function Waveform() {
  return (
    <div className="live-indicator">
      <div className="waveform" aria-hidden="true">
        {WAVE_BARS.map((height, i) => (
          <span key={i} className="wave-bar" style={{ height, animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
      <span className="live-label">live channel active</span>
    </div>
  );
}

export function Hero() {
  const heroRef = useRef<HTMLElement>(null);
  const laptopRef = useRef<HTMLDivElement>(null);
  const phoneRef = useRef<HTMLDivElement>(null);
  useHeroParallax(heroRef, laptopRef, phoneRef);

  return (
    <section ref={heroRef} className="hero">
      <div className="blob blob-1" aria-hidden="true" />
      <div className="blob blob-2" aria-hidden="true" />
      <div className="blob blob-3" aria-hidden="true" />

      <div className="container hero-grid">
        <div className="hero-copy">
          <span className="eyebrow-pill">BUILT FOR LIVE BROADCAST</span>
          <h1>
            <span className="nowrap">Push-to-talk</span> intercom
            <br />
            <span className="text-gradient">for broadcast teams</span>
          </h1>
          <p className="hero-sub">
            Multi-channel, low-latency voice for your whole crew — running on your own network, on the
            desktops and phones you already have.
          </p>
          <Waveform />
          <div className="hero-ctas">
            <Link to="/signup" className="btn btn-gradient btn-lg">Start free →</Link>
            <a href="#how-it-works" className="btn btn-outline btn-lg">See how it works</a>
          </div>
        </div>

        <div className="hero-visual">
          <div ref={laptopRef} className="parallax-layer">
            <div className="laptop">
              <div className="laptop-bezel">
                <img
                  className="laptop-screen"
                  src="/screens/desktop-dashboard.jpg"
                  width={1440} height={900}
                  alt="MediaCom desktop admin dashboard showing active users, rooms and server status"
                  fetchPriority="high"
                />
              </div>
              <div className="laptop-base" />
            </div>
          </div>
          <div ref={phoneRef} className="parallax-layer phone-layer">
            <div className="phone">
              <img
                className="phone-screen"
                src="/screens/mobile-app.jpg"
                width={800} height={1733}
                alt="MediaCom mobile app with channel list and push-to-talk button"
              />
              <span className="phone-camera" aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
