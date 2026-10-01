// Transactional email is stubbed for now. Plug a real provider (Resend,
// Postmark, ...) into EmailProvider.send and wire it up in place of
// ConsoleEmailProvider below — no other code needs to change.

import { env } from "../config/env";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}

class ConsoleEmailProvider implements EmailProvider {
  async send(message: EmailMessage): Promise<void> {
    // The body (which can contain a raw license key or magic-link token) is
    // only logged outside production — this stub is never what actually
    // sends email once a real provider is wired in, but staging/dev runs
    // need SOME way to read the link/key a real inbox would show, since only
    // a hash of a magic-link token is ever persisted (see
    // src/services/portalSession.ts).
    console.log("[email:stub] would send email:", {
      to: message.to,
      subject: message.subject,
      ...(env.nodeEnv !== "production" ? { text: message.text } : {}),
    });
  }
}

const provider: EmailProvider = new ConsoleEmailProvider();

export interface SendLicenseEmailParams {
  to: string;
  customerName: string;
  rawKey: string;
  tier?: string;
  deviceLimit: number;
  expiresAt: string | null;
}

/**
 * Sends the raw license key to the customer. This is the only place the raw
 * key travels after generation — it is never persisted, only emailed once.
 */
export async function sendLicenseEmail(params: SendLicenseEmailParams): Promise<void> {
  const expiry = params.expiresAt ? `Expires: ${params.expiresAt}` : "Perpetual license (no expiration)";

  await provider.send({
    to: params.to,
    subject: "Your MediaCom license key",
    text:
      `Hi ${params.customerName},\n\n` +
      `Your MediaCom license key is:\n\n${params.rawKey}\n\n` +
      `Device limit: ${params.deviceLimit}\n${expiry}\n\n` +
      `Enter this key in the MediaCom desktop app to activate.`,
  });
}

export interface SendMagicLinkEmailParams {
  to: string;
  loginUrl: string; // full URL, portal origin + /verify?token=<raw token>
  ttlMinutes: number;
}

/**
 * Sends a one-time portal login link. The raw token lives only in this URL —
 * see src/services/portalSession.ts's hashMagicLinkToken() for what actually
 * gets persisted.
 */
export async function sendMagicLinkEmail(params: SendMagicLinkEmailParams): Promise<void> {
  await provider.send({
    to: params.to,
    subject: "Your MediaCom portal login link",
    text:
      `Click the link below to log in to the MediaCom customer portal:\n\n${params.loginUrl}\n\n` +
      `This link expires in ${params.ttlMinutes} minutes and can only be used once. ` +
      `If you didn't request this, you can safely ignore this email.`,
  });
}
