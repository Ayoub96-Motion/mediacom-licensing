import { apiRequest } from "./client";
import type { Customer } from "../types";

export function requestMagicLink(email: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>("/api/portal/auth/request-link", { method: "POST", body: { email } });
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
