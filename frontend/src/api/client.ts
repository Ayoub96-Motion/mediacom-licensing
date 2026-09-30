import type { ApiErrorBody } from "../types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

if (!BASE_URL) {
  // Fail loudly at load time rather than every request silently hitting "undefined/..."
  throw new Error("VITE_API_BASE_URL is not set — copy .env.example to .env and fill it in");
}

// Exposed for callers that can't go through apiRequest() — currently only
// the release upload (multipart/form-data with a progress callback, which
// needs XMLHttpRequest, not fetch) in api/releases.ts.
export function getBaseUrl(): string {
  return BASE_URL;
}

const TOKEN_STORAGE_KEY = "mediacom_admin_token";

let inMemoryToken: string | null = localStorage.getItem(TOKEN_STORAGE_KEY);

export function getToken(): string | null {
  return inMemoryToken;
}

export function setToken(token: string): void {
  inMemoryToken = token;
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearToken(): void {
  inMemoryToken = null;
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

// Set by AuthContext so client.ts can trigger a redirect on 401 without
// importing React Router here (keeps this module framework-agnostic).
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  auth?: boolean; // default true
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    clearToken();
    onUnauthorized?.();
    throw new ApiError(401, "unauthorized", "Session expired — please log in again");
  }

  if (res.status === 204) {
    return undefined as T;
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new ApiError(res.status, "invalid_response", "Server returned an invalid response");
  }

  if (!res.ok) {
    const err = json as ApiErrorBody;
    throw new ApiError(res.status, err.error?.code ?? "unknown_error", err.error?.message ?? "Request failed");
  }

  return json as T;
}
