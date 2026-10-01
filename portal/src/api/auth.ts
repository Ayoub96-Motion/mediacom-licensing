import { apiRequest } from "./client";
import type { Customer } from "../types";

// debugToken is only ever present when the API has TEST_EXPOSE_MAGIC_LINK=1
// set (staging only, never production) — see src/routes/portalAuth.ts.
export function requestMagicLink(email: string): Promise<{ message: string; debugToken?: string }> {
  return apiRequest<{ message: string; debugToken?: string }>("/api/portal/auth/request-link", {
    method: "POST",
    body: { email },
  });
}

export function verifyMagicLink(token: string): Promise<{ customer: Customer }> {
  return apiRequest<{ customer: Customer }>("/api/portal/auth/verify", { method: "POST", body: { token } });
}

export function logout(): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>("/api/portal/auth/logout", { method: "POST" });
}

/** Revokes every session for this customer, not just the current one. */
export function logoutAll(): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>("/api/portal/auth/logout-all", { method: "POST" });
}
