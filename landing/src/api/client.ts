import { API_BASE_URL } from "../config";

if (!API_BASE_URL) {
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

/**
 * Unlike the portal's client, never sends credentials — every call the
 * landing page makes is anonymous (the request-access form, and the
 * magic-link request whose emailed link then signs the customer in on the
 * portal itself, not here).
 */
export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

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
