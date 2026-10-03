import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { AuditLogEntry } from "../types";
import { actionLabel, actorLabel, summarizeEntry } from "../lib/auditFormat";
import { EmptyState } from "./StateViews";
import { ActivityIcon, BanIcon, CheckCircleIcon, KeyIcon, MonitorIcon, PackageIcon, UserIcon } from "./Icons";

// Where a given entry's target actually lives — Customer/License both have
// their own detail page; Device doesn't, so fall back to the license it
// belongs to (device.deactivate's metadata always carries licenseId) rather
// than linking nowhere.
function targetLink(entry: AuditLogEntry): string | null {
  if (entry.targetType === "Customer") return `/customers/${entry.targetId}`;
  if (entry.targetType === "License") return `/licenses/${entry.targetId}`;
  if (entry.targetType === "Device" && typeof entry.metadata?.licenseId === "string") {
    return `/licenses/${entry.metadata.licenseId}`;
  }
  return null;
}

type Tone = "lime" | "warning" | "neutral";

// Colour by what the action did: issuing/granting = lime, taking away =
// warning, everything else (updates, logins, refreshes) = neutral.
function toneFor(action: string): Tone {
  if (/revoke|deactivate|delete|unpublish/.test(action)) return "warning";
  if (/create|approve|activate|publish|upload|signup_request$/.test(action)) return "lime";
  return "neutral";
}

function iconFor(entry: AuditLogEntry, tone: Tone): ReactNode {
  if (tone === "warning") return <BanIcon size={16} />;
  if (entry.action === "customer.approve") return <CheckCircleIcon size={16} />;
  switch (entry.targetType) {
    case "License": return <KeyIcon size={16} />;
    case "Customer": return <UserIcon size={16} />;
    case "Device": return <MonitorIcon size={16} />;
    case "Release": return <PackageIcon size={16} />;
    default: return <ActivityIcon size={16} />;
  }
}

/**
 * Timeline used everywhere audit entries are shown — the dashboard's recent
 * feed, the full Audit Log page, and the customer/license detail pages.
 */
export function ActivityTimeline({ entries }: { entries: AuditLogEntry[] }) {
  if (entries.length === 0) return <EmptyState label="No activity recorded yet." />;

  return (
    <div className="timeline">
      {entries.map((entry) => {
        const link = targetLink(entry);
        const tone = toneFor(entry.action);
        return (
          <div key={entry.id} className="timeline-item">
            <span className={`icon-badge sm ${tone === "lime" ? "" : tone}`}>{iconFor(entry, tone)}</span>
            <div className="timeline-body">
              <div className="timeline-title">
                {actionLabel(entry.action)}
                {link && <Link to={link}>view →</Link>}
              </div>
              <div className="timeline-desc">{summarizeEntry(entry)}</div>
              <div className="timeline-meta">
                <span className="actor">{actorLabel(entry)}</span>
                <span>·</span>
                <span>{new Date(entry.createdAt).toLocaleString()}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
