import type { AuditLogEntry } from "../types";
import { ActivityTimeline } from "./ActivityTimeline";

export function ActivityList({ entries }: { entries: AuditLogEntry[] }) {
  return <ActivityTimeline entries={entries} />;
}
