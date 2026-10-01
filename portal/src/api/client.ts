const BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

if (!BASE_URL) {
  throw new Error("VITE_API_BASE_URL is not set — copy .env.example to .env and fill it in");
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
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
}

/**
 * Always sends credentials: 'include' — the portal session lives in an
 * httpOnly cookie (see mediacom-licensing's src/services/portalSession.ts),
 * never in anything this JS can read or attach itself, so every request
 * just needs the browser to attach it automatically.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    credentials: "include",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

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
    const err = json as { error?: { code: string; message: string } };
    throw new ApiError(res.status, err.error?.code ?? "unknown_error", err.error?.message ?? "Request failed");
  }

  return json as T;
}
