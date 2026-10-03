import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";
import { CheckIcon, DevicesIcon, GlobeIcon, LayersIcon, MicIcon, ServerIcon, ShieldIcon } from "./Icons";

const STAGGER_MS = 80;

/** Index-based stagger for a run of .reveal siblings. */
function stagger(index: number): CSSProperties {
  return { transitionDelay: `${index * STAGGER_MS}ms` };
}

function SectionHeader({ eyebrow, title, sub }: { eyebrow: string; title: string; sub: string }) {
  return (
    <div className="section-header reveal">
      <span className="section-eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      <p>{sub}</p>
    </div>
  );
}

const STEPS = [
  {
    title: "Install the server",
    body: "Run the MediaCom server on a Windows machine on your production network. Everything stays on your LAN.",
  },
  {
    title: "Activate your license",
    body: "Paste the license key we email you. The server activates once, then keeps working through internet outages.",
  },
  {
    title: "Connect your crew",
    body: "Crew join from desktop or mobile, pick their channels, and talk — no accounts or cloud relay in the way.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="section">
      <div className="container">
        <SectionHeader
          eyebrow="How it works"
          title="On air in three steps"
          sub="From download to a talking crew in minutes, not a hardware install."
        />
        <div className="steps">
          {STEPS.map((step, i) => (
            <div key={step.title} className="reveal" style={stagger(i)}>
              <div className="step">
                <span className="step-number">{i + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const FEATURES: { icon: ReactNode; title: string; body: string }[] = [
  {
    icon: <LayersIcon />,
    title: "Multi-channel groups",
    body: "Split production, camera, audio and stage into their own channels. Listen to several, talk on one.",
  },
  {
    icon: <MicIcon />,
    title: "Push-to-talk WebRTC",
    body: "Hold to talk, release to listen. Low-latency WebRTC audio, built for cues that can't arrive late.",
  },
  {
    icon: <ServerIcon />,
    title: "Local-first, offline-ready",
    body: "Runs entirely on your local network. If the internet drops mid-show, your intercom doesn't.",
  },
  {
    icon: <ShieldIcon />,
    title: "Role-based access",
    body: "Directors, operators and guests each get the channels and controls their role needs — nothing more.",
  },
  {
    icon: <DevicesIcon />,
    title: "Device management",
    body: "See every activated device and free up a seat from the customer portal when kit changes hands.",
  },
  {
    icon: <GlobeIcon />,
    title: "Cross-platform",
    body: "Windows server, desktop clients, and iOS and Android apps — all on the same channels.",
  },
];

export function Features() {
  return (
    <section id="features" className="section section-alt">
      <div className="container">
        <SectionHeader
          eyebrow="Features"
          title="Everything a live crew needs to talk"
          sub="The essentials of a hardware intercom, on software you control."
        />
        <div className="feature-grid">
          {FEATURES.map((f, i) => (
            <div key={f.title} className="reveal" style={stagger(i)}>
              <article className="card feature-card">
                <span className="icon-badge">{f.icon}</span>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </article>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// TODO(pricing): placeholder prices — confirm before launch. Plan limits
// mirror the backend tier presets (src/constants/tiers.ts): Starter =
// "starter", Pro = "studio", Studio = "enterprise".
const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: "Free",
    period: "",
    blurb: "For small crews getting off the ground.",
    features: ["Up to 15 users", "Up to 6 channels", "1 location", "Desktop & mobile apps"],
    cta: "Start free",
    popular: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: "$49",
    period: "/mo",
    blurb: "For production teams running regular shows.",
    features: ["Up to 50 users", "Unlimited channels", "Guest access", "Everything in Starter"],
    cta: "Get Pro",
    popular: true,
  },
  {
    id: "studio",
    name: "Studio",
    price: "Custom",
    period: "",
    blurb: "For facilities and multi-site broadcasters.",
    features: ["Unlimited users", "Multiple locations", "Multi-location broadcast", "White label"],
    cta: "Talk to us",
    popular: false,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="section">
      <div className="container">
        <SectionHeader
          eyebrow="Pricing"
          title="Simple plans that scale with your crew"
          sub="Every plan includes the server, desktop clients and mobile apps."
        />
        <div className="pricing-grid">
          {PLANS.map((plan, i) => (
            <div key={plan.id} className="reveal" style={stagger(i)}>
              <article className={`card pricing-card${plan.popular ? " is-popular" : ""}`}>
                {plan.popular && <span className="popular-ribbon">POPULAR</span>}
                <h3>{plan.name}</h3>
                <p className="plan-blurb">{plan.blurb}</p>
                <div className="plan-price">
                  {plan.price}
                  {plan.period && <span>{plan.period}</span>}
                </div>
                <ul className="plan-features">
                  {plan.features.map((feature) => (
                    <li key={feature}>
                      <span className="icon-badge icon-badge-sm"><CheckIcon /></span>
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  to={`/signup?plan=${plan.id}`}
                  className={`btn btn-block ${plan.popular ? "btn-gradient" : "btn-ghost"}`}
                >
                  {plan.cta}
                </Link>
              </article>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CtaBand() {
  return (
    <section className="cta-band">
      <div className="blob blob-cta" aria-hidden="true" />
      <div className="container cta-inner reveal">
        <h2>Put your whole crew on the same channel</h2>
        <p>Request access and we'll get your license set up.</p>
        <Link to="/signup" className="btn btn-gradient btn-lg">Request access →</Link>
      </div>
    </section>
  );
}
