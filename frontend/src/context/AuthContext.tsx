import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { clearToken, getToken, setToken as persistToken, setUnauthorizedHandler } from "../api/client";
import { login as loginRequest } from "../api/auth";
import type { AdminUser } from "../types";

interface AuthContextValue {
  token: string | null;
  admin: AdminUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const ADMIN_STORAGE_KEY = "mediacom_admin_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(getToken());
  const [admin, setAdmin] = useState<AdminUser | null>(() => {
    try {
      const raw = localStorage.getItem(ADMIN_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as AdminUser) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setTokenState(null);
      setAdmin(null);
      localStorage.removeItem(ADMIN_STORAGE_KEY);
    });
  }, []);

  async function login(email: string, password: string) {
    setLoading(true);
    try {
      const result = await loginRequest(email, password);
      persistToken(result.token);
      localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(result.admin));
      setTokenState(result.token);
      setAdmin(result.admin);
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    clearToken();
    localStorage.removeItem(ADMIN_STORAGE_KEY);
    setTokenState(null);
    setAdmin(null);
  }

  return (
    <AuthContext.Provider value={{ token, admin, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
