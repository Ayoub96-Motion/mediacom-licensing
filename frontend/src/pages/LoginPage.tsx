import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../api/client";
import { KeyIcon } from "../components/Icons";

export function LoginPage() {
  const { token, loading, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (token) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    }
  }

  return (
    <div className="login-shell">
      <div className="sidebar-brand" style={{ padding: 0 }}>
        <span className="sidebar-logo"><KeyIcon size={18} /></span>
        <span className="sidebar-wordmark">
          MediaCom
          <span>Licensing</span>
        </span>
      </div>
      <form onSubmit={handleSubmit} className="card login-card">
        <div className="page-eyebrow">Admin dashboard</div>
        <h3>Sign in</h3>
        <p className="muted-text" style={{ marginTop: 0, marginBottom: 20 }}>Use your MediaCom admin account.</p>
        {error && <div className="error-box">{error}</div>}
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            style={{ width: "100%" }}
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: "100%" }}
          />
        </div>
        <button type="submit" className="primary" disabled={loading} style={{ width: "100%", marginTop: 4 }}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
