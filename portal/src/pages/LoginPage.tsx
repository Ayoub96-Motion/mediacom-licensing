import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { requestMagicLink } from "../api/auth";
import { ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { AuthShell } from "../components/AuthShell";
import { AlertCircleIcon, ArrowRightIcon, MailIcon } from "../components/Icons";

export function LoginPage() {
  const { customer, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Only ever populated when the API has TEST_EXPOSE_MAGIC_LINK=1 set
  // (staging only — see src/routes/portalAuth.ts). Lets local/staging
  // testing click straight through instead of digging the link out of
  // server console output by hand, which is exactly the kind of manual
  // copy-paste step that's easy to get subtly wrong (truncation, stray
  // characters) and produce a "token invalid" that has nothing to do with
  // the actual auth logic.
  const [devShortcutUrl, setDevShortcutUrl] = useState<string | null>(null);

  if (!loading && customer) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      // Always succeeds with the same generic message regardless of whether
      // the email is actually registered — see mediacom-licensing's
      // src/routes/portalAuth.ts. The UI reflects that: there is no
      // "that email doesn't exist" error state to show.
      const result = await requestMagicLink(email.trim());
      setDevShortcutUrl(result.debugToken ? `/login/verify?token=${result.debugToken}` : null);
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <AuthShell>
        <h1>Check your email</h1>
        <p>If that email is registered, we've sent a login link to <strong>{email}</strong>.</p>
        <p className="auth-dark-note">The link expires in 15 minutes and can only be used once.</p>
        <div className="auth-dark-links">
          {devShortcutUrl && (
            <a href={devShortcutUrl} className="auth-dark-link">Dev shortcut: open the login link now</a>
          )}
          <button type="button" className="auth-dark-link" onClick={() => setSent(false)}>Use a different email</button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell as="form" onSubmit={handleSubmit}>
      <h1>MediaCom Portal</h1>
      <p>Enter your email and we'll send you a login link — no password needed.</p>
      {error && (
        <div className="auth-dark-error" role="alert">
          <AlertCircleIcon width={16} height={16} />
          <span>{error}</span>
        </div>
      )}
      <div className="auth-dark-field">
        <label htmlFor="email">Email</label>
        <div className="auth-dark-input">
          <MailIcon width={16} height={16} />
          <input
            id="email" type="email" required autoFocus autoComplete="email"
            placeholder="you@studio.com"
            value={email} onChange={(e) => setEmail(e.target.value)}
          />
        </div>
      </div>
      <button type="submit" className="auth-dark-button" disabled={busy}>
        {busy ? "Sending…" : <>Send login link <ArrowRightIcon width={16} height={16} /></>}
      </button>
    </AuthShell>
  );
}
