import type { AuditLogEntry } from "../types";
import { actionLabel, actorLabel, summarizeEntry } from "../lib/auditFormat";
import { EmptyState } from "./StateViews";

export function ActivityList({ entries }: { entries: AuditLogEntry[] }) {
  if (entries.length === 0) return <EmptyState label="No activity recorded yet." />;

  return (
    <table>
      <thead>
        <tr>
          <th>Action</th>
          <th>Details</th>
          <th>Admin</th>
          <th>When</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => (
          <tr key={entry.id}>
            <td style={{ whiteSpace: "nowrap" }}>{actionLabel(entry.action)}</td>
            <td style={{ fontSize: 12, color: "#4b5563" }}>{summarizeEntry(entry)}</td>
            <td style={{ fontSize: 12 }}>{actorLabel(entry)}</td>
            <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>{new Date(entry.createdAt).toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
