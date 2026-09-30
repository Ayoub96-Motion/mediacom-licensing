import { Link } from "react-router-dom";
import type { AuditLogEntry } from "../types";
import { actionLabel, actorLabel, summarizeEntry } from "../lib/auditFormat";
import { EmptyState } from "./StateViews";

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

export function RecentActivityFeed({ entries }: { entries: AuditLogEntry[] }) {
  if (entries.length === 0) return <EmptyState label="No activity recorded yet." />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {entries.map((entry) => {
        const link = targetLink(entry);
        return (
          <div key={entry.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13, borderBottom: "1px solid #eef0f2", paddingBottom: 10 }}>
            <div>
              <strong>{actionLabel(entry.action)}</strong>
              {" — "}
              <span style={{ color: "#4b5563" }}>{summarizeEntry(entry)}</span>
              {link && (
                <>
                  {" "}
                  <Link to={link}>view</Link>
                </>
              )}
            </div>
            <div style={{ color: "#9ca3af", whiteSpace: "nowrap", fontSize: 12 }}>
              {actorLabel(entry)} · {new Date(entry.createdAt).toLocaleString()}
            </div>
          </div>
        );
      })}
    </div>
  );
}
