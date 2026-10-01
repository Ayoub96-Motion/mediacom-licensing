import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { verifyMagicLink } from "../api/auth";
import { ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";

export function VerifyPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const token = searchParams.get("token");

  useEffect(() => {
    if (!token) {
      setError("Missing login token.");
      return;
    }
    let cancelled = false;
    verifyMagicLink(token)
      .then(async () => {
        if (cancelled) return;
        await refresh();
        navigate("/", { replace: true });
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Could not verify this login link.");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="auth-shell">
      <div className="auth-card">
        {error ? (
          <>
            <h1>Login link didn't work</h1>
            <div className="error-box">{error}</div>
            <Link to="/login" className="link">Request a new login link</Link>
          </>
        ) : (
          <h1>Logging you in…</h1>
        )}
      </div>
    </div>
  );
}
