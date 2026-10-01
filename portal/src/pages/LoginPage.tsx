import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { requestMagicLink } from "../api/auth";
import { ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";

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
      <div className="auth-shell">
        <div className="auth-card">
          <h1>Check your email</h1>
          <p>If that email is registered, we've sent a login link to <strong>{email}</strong>.</p>
          <p className="muted">The link expires in 15 minutes and can only be used once.</p>
          {devShortcutUrl && (
            <p>
              <a href={devShortcutUrl} className="link">Dev shortcut: open the login link now</a>
            </p>
          )}
          <button className="link" onClick={() => setSent(false)}>Use a different email</button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>MediaCom Portal</h1>
        <p className="muted">Enter your email and we'll send you a login link — no password needed.</p>
        {error && <div className="error-box">{error}</div>}
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email" type="email" required autoFocus
            value={email} onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <button type="submit" className="primary" disabled={busy} style={{ width: "100%" }}>
          {busy ? "Sending…" : "Send login link"}
        </button>
      </form>
    </div>
  );
}
