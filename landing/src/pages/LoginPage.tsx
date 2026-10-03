import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { AuthShell } from "../components/AuthShell";
import { requestMagicLink } from "../api/public";
import { ApiError } from "../api/client";
import { PORTAL_URL } from "../config";

/**
 * Customer login — the portal's existing magic-link flow, not a new one.
 * This page only asks for the link; the emailed link opens the portal's
 * /login/verify page, which is what actually creates the session (on the
 * portal's own origin, where its session cookie belongs).
 */
export function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Staging only (TEST_EXPOSE_MAGIC_LINK=1) — same dev shortcut the portal's own login page shows.
  const [devShortcutUrl, setDevShortcutUrl] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      // Same generic response whether or not the email is registered.
      const result = await requestMagicLink(email.trim());
      setDevShortcutUrl(result.debugToken ? `${PORTAL_URL}/login/verify?token=${result.debugToken}` : null);
      setSent(true);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 429
          ? "Too many requests — please try again in a few minutes."
          : "Something went wrong. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <AuthShell footer={<button className="link-button" onClick={() => setSent(false)}>Use a different email</button>}>
        <span className="auth-eyebrow">Check your inbox</span>
        <h1>Login link sent</h1>
        <p className="auth-sub">
          If <strong>{email.trim()}</strong> has a MediaCom license, we've sent it a login link. It expires in
          15 minutes and can only be used once.
        </p>
        {devShortcutUrl && (
          <a href={devShortcutUrl} className="dev-shortcut">Dev shortcut: open the login link now</a>
        )}
      </AuthShell>
    );
  }

  return (
    <AuthShell
      footer={
        <>
          Don't have a license yet? <Link to="/signup">Request access</Link>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <span className="auth-eyebrow">Customer login</span>
        <h1>Log in to MediaCom</h1>
        <p className="auth-sub">Enter the email your license was issued to and we'll send you a login link — no password needed.</p>
        {error && <div className="error-box" role="alert">{error}</div>}
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" required autoFocus autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <button type="submit" className="btn btn-gradient btn-block btn-lg" disabled={busy}>
          {busy ? "Sending…" : "Send login link →"}
        </button>
      </form>
    </AuthShell>
  );
}
