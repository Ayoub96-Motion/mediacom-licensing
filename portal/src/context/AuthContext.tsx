import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { getMe } from "../api/account";
import { logout as logoutRequest, logoutAll as logoutAllRequest } from "../api/auth";
import { ApiError } from "../api/client";
import type { Customer, PortalLicense } from "../types";

interface AuthContextValue {
  customer: Customer | null;
  licenses: PortalLicense[];
  loading: boolean;
  // Called after a successful magic-link verify (which sets the cookie) and
  // after any action that changes license/device state, to refetch /me.
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [licenses, setLicenses] = useState<PortalLicense[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const result = await getMe();
      setCustomer(result.customer);
      setLicenses(result.licenses);
    } catch (err) {
      // 401 (no/expired session) just means "logged out" — not an error to
      // surface anywhere; any other failure also degrades to logged-out
      // rather than leaving the UI in an indeterminate loading state.
      if (!(err instanceof ApiError) || err.status !== 401) {
        console.error("Failed to load portal session:", err);
      }
      setCustomer(null);
      setLicenses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function logout() {
    try {
      await logoutRequest();
    } finally {
      setCustomer(null);
      setLicenses([]);
    }
  }

  async function logoutAll() {
    try {
      await logoutAllRequest();
    } finally {
      setCustomer(null);
      setLicenses([]);
    }
  }

  return (
    <AuthContext.Provider value={{ customer, licenses, loading, refresh, logout, logoutAll }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
