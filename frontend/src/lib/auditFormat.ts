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
      return `Deactivated "${m.label || m.fingerprint}"${m.method ? ` (${m.method})` : ""}`;

    case "device.activate":
      return `Activated${m.machineName ? ` "${m.machineName}"` : ""}`;

    case "device.refresh":
      return "Token refreshed";

    default:
      return JSON.stringify(m);
  }
}
