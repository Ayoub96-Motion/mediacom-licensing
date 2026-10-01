import { useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { verifyMagicLink } from "../api/auth";
import { ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";

// Deliberately does NOT verify on mount (no useEffect calling the API here).
// Two reasons:
//   1. Email security scanners pre-fetch links in an inbox before a person
//      ever sees it — if loading this page consumed the token, the real
//      customer's click would always find it already "used".
//   2. A mount-time side effect that calls a mutating endpoint breaks under
//      React StrictMode's intentional double-invoke of effects in
//      development: confirmed live (Playwright, two real POSTs from one
//      page load) that the previous auto-verify-in-useEffect design fired
//      /api/portal/auth/verify twice per visit.
// Consuming the token now only happens on an explicit click, which is
// itself guarded against firing twice (double-click, or anything else) by
// hasSubmitted below.
export function VerifyPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const hasSubmitted = useRef(false);
  const token = searchParams.get("token");

  async function handleLogin() {
    if (hasSubmitted.current || !token) return;
    hasSubmitted.current = true;
    setVerifying(true);
    setError(null);
    try {
      await verifyMagicLink(token);
      await refresh();
      navigate("/", { replace: true });
    } catch (err) {
      hasSubmitted.current = false; // a failed attempt (e.g. transient network error) can be retried
      setVerifying(false);
      setError(err instanceof ApiError ? err.message : "Could not verify this login link.");
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        {!token ? (
          <>
            <h1>Login link didn't work</h1>
            <div className="error-box">Missing login token.</div>
            <Link to="/login" className="link">Request a new login link</Link>
          </>
        ) : error ? (
          <>
            <h1>Login link didn't work</h1>
            <div className="error-box">{error}</div>
            <Link to="/login" className="link">Request a new login link</Link>
          </>
        ) : (
          <>
            <h1>MediaCom Portal</h1>
            <p className="muted">Click below to finish logging in.</p>
            <button type="button" className="primary" style={{ width: "100%" }} onClick={handleLogin} disabled={verifying}>
              {verifying ? "Logging in…" : "Log in to MediaCom"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
