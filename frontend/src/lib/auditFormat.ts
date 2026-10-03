import type { AuditLogEntry } from "../types";

const ACTION_LABELS: Record<string, string> = {
  "customer.create": "Created customer",
  "customer.update": "Updated customer",
  "license.create": "Issued license",
  "license.update": "Updated license",
  "license.revoke": "Revoked license",
  "device.deactivate": "Deactivated device",
  "device.activate": "Activated device",
  "device.refresh": "Refreshed device token",
  "release.upload": "Uploaded release",
  "release.update": "Updated release",
  "release.publish": "Published release",
  "release.unpublish": "Unpublished release",
  "release.delete": "Deleted release",
  "release.download": "Downloaded release",
  "customer.login": "Logged in to portal",
  "customer.license.reveal_key": "Revealed license key",
  "customer.device.deactivate": "Deactivated device (self-service)",
  "customer.signup_request": "Requested access",
  "customer.signup_request.update": "Re-submitted access request",
  "customer.approve": "Approved access request",
};

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

/** "device.activate"/"device.refresh" entries have adminId: null — this is
 *  what the UI shows in the admin column instead. */
export function actorLabel(entry: AuditLogEntry): string {
  return entry.admin ? entry.admin.email : `(${entry.actorType})`;
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "none";
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

// Diffs a {before, after} pair field-by-field into readable "X changed from
// A to B" lines — including one level into nested objects (e.g. a license's
// `features`), since that's the only nested field these actions ever diff.
function diffLines(before: Record<string, unknown>, after: Record<string, unknown>): string[] {
  const lines: string[] = [];
  for (const key of Object.keys(after)) {
    const b = before[key];
    const a = after[key];
    if (b !== null && typeof b === "object" && a !== null && typeof a === "object" && !Array.isArray(b)) {
      const bObj = b as Record<string, unknown>;
      const aObj = a as Record<string, unknown>;
      for (const subKey of Object.keys(aObj)) {
        if (bObj[subKey] !== aObj[subKey]) {
          lines.push(`${key}.${subKey}: ${formatValue(bObj[subKey])} → ${formatValue(aObj[subKey])}`);
        }
      }
    } else if (JSON.stringify(b) !== JSON.stringify(a)) {
      lines.push(`${key}: ${formatValue(b)} → ${formatValue(a)}`);
    }
  }
  return lines;
}

export function summarizeEntry(entry: AuditLogEntry): string {
  const m = entry.metadata ?? {};

  switch (entry.action) {
    case "customer.create":
      return `Created "${m.name}" (${m.email})`;

    case "customer.update": {
      const lines = diffLines((m.before as Record<string, unknown>) ?? {}, (m.after as Record<string, unknown>) ?? {});
      return lines.length ? lines.join(", ") : "No fields changed";
    }

    case "license.create":
      return `Issued a ${m.tier ?? "custom"} license (device limit ${m.deviceLimit}, ${m.type})`;

    case "license.update": {
      const lines = diffLines((m.before as Record<string, unknown>) ?? {}, (m.after as Record<string, unknown>) ?? {});
      return lines.length ? lines.join(", ") : "No fields changed";
    }

    case "license.revoke":
      return `Revoked (was ${m.previousStatus})`;

    case "device.deactivate":
      return `Deactivated ${m.label || m.fingerprint ? `"${m.label || m.fingerprint}"` : "a device"}${m.method ? ` (${m.method})` : ""}`;

    case "device.activate":
      return `Activated${m.machineName ? ` "${m.machineName}"` : ""}`;

    case "device.refresh":
      return "Token refreshed";

    case "release.upload":
      return `${m.product} ${m.version} (${m.channel})${m.fileSize ? `, ${Math.round(Number(m.fileSize) / 1024 / 1024)} MB` : ""}`;

    case "release.update":
    case "release.publish":
    case "release.unpublish": {
      const lines = diffLines((m.before as Record<string, unknown>) ?? {}, (m.after as Record<string, unknown>) ?? {});
      return lines.length ? lines.join(", ") : "No fields changed";
    }

    case "release.delete":
      return `${m.product} ${m.version}`;

    case "release.download":
      return `${m.product} ${m.version}`;

    case "customer.login":
      return "Portal login via magic link";

    case "customer.license.reveal_key":
      return "Customer revealed their license key";

    case "customer.device.deactivate":
      return "Customer deactivated one of their own devices";

    case "customer.signup_request":
    case "customer.signup_request.update":
      return `${m.name} (${m.email}) from ${m.company}, team size ${m.teamSize}`;

    case "customer.approve":
      return "Approved by issuing their first license";

    default:
      return JSON.stringify(m);
  }
}
