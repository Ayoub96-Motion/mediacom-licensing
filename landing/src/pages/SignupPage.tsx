import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AuthShell } from "../components/AuthShell";
import { requestAccess, type TeamSize } from "../api/public";
import { ApiError } from "../api/client";

const TEAM_SIZES: { value: TeamSize; label: string }[] = [
  { value: "1-15", label: "1–15" },
  { value: "16-50", label: "16–50" },
  { value: "50+", label: "50+" },
];

// Pricing cards link here with ?plan=<id> — pre-select the matching size.
const TEAM_SIZE_FOR_PLAN: Record<string, TeamSize> = { starter: "1-15", pro: "16-50", studio: "50+" };

export function SignupPage() {
  const [params] = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [teamSize, setTeamSize] = useState<TeamSize | null>(TEAM_SIZE_FOR_PLAN[params.get("plan") ?? ""] ?? null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!teamSize) {
      setError("Please choose a team size.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await requestAccess({ name: name.trim(), email: email.trim(), company: company.trim(), teamSize });
      setDone(true);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 429
          ? "Too many requests from this network — please try again later."
          : err instanceof ApiError && err.status === 400
            ? "Please check the form — something doesn't look right."
            : "Something went wrong. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <AuthShell footer={<Link to="/">← Back to home</Link>}>
        <span className="auth-eyebrow">Request received</span>
        <h1>Thanks, {name.trim().split(" ")[0]}!</h1>
        <p className="auth-sub">
          We'll review your request and email your license key to <strong>{email.trim()}</strong>. Once
          it arrives, you can log in to the customer portal with that address.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      footer={
        <>
          Already have a license? <Link to="/login">Log in</Link>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <span className="auth-eyebrow">Request access</span>
        <h1>Get MediaCom for your crew</h1>
        <p className="auth-sub">Tell us a little about your team and we'll set up your license.</p>

        {error && <div className="error-box" role="alert">{error}</div>}

        <div className="field">
          <label htmlFor="name">Full name</label>
          <input id="name" required autoComplete="name" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="email">Work email</label>
          <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="company">Studio / company name</label>
          <input id="company" required autoComplete="organization" value={company} onChange={(e) => setCompany(e.target.value)} />
        </div>
        <fieldset className="field">
          <legend>Team size</legend>
          <div className="pill-group">
            {TEAM_SIZES.map((size) => (
              <label key={size.value} className="pill-option">
                <input
                  type="radio" name="teamSize" value={size.value}
                  checked={teamSize === size.value}
                  onChange={() => setTeamSize(size.value)}
                />
                <span>{size.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <button type="submit" className="btn btn-gradient btn-block btn-lg" disabled={busy}>
          {busy ? "Sending…" : "Request access →"}
        </button>
      </form>
    </AuthShell>
  );
}
