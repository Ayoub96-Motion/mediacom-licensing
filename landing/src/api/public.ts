import { apiPost } from "./client";

export type TeamSize = "1-15" | "16-50" | "50+";

export interface SignupRequestInput {
  name: string;
  email: string;
  company: string;
  teamSize: TeamSize;
}

/** Creates a "pending" Customer — see mediacom-licensing's src/routes/publicSignup.ts. */
export function requestAccess(input: SignupRequestInput): Promise<{ message: string }> {
  return apiPost<{ message: string }>("/public/signup-request", input);
}

// The portal's existing magic-link login (src/routes/portalAuth.ts) — same
// endpoint the portal's own login page calls. debugToken is only ever
// present on staging with TEST_EXPOSE_MAGIC_LINK=1.
export function requestMagicLink(email: string): Promise<{ message: string; debugToken?: string }> {
  return apiPost<{ message: string; debugToken?: string }>("/api/portal/auth/request-link", { email });
}
