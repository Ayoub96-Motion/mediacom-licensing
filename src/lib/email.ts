// Transactional email is stubbed for now. Plug a real provider (Resend,
// Postmark, ...) into EmailProvider.send and wire it up in place of
// ConsoleEmailProvider below — no other code needs to change.

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
    console.log("[email:stub] would send email:", {
      to: message.to,
      subject: message.subject,
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
