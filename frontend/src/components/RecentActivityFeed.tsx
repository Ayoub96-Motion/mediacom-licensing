import type { AuditLogEntry } from "../types";
import { ActivityTimeline } from "./ActivityTimeline";

export function RecentActivityFeed({ entries }: { entries: AuditLogEntry[] }) {
  return <ActivityTimeline entries={entries} />;
}
