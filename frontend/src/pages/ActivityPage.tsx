import { useEffect, useState } from "react";
import { listAuditLog } from "../api/auditLog";
import { ApiError } from "../api/client";
import type { AuditLogEntry, AuditTargetType } from "../types";
import { Loading, ErrorBox } from "../components/StateViews";
import { ActivityList } from "../components/ActivityList";
import { PageHeader } from "../components/PageHeader";

const PAGE_SIZE = 30;

export function ActivityPage() {
  const [items, setItems] = useState<AuditLogEntry[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [targetType, setTargetType] = useState<AuditTargetType | "">("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const result = await listAuditLog({ targetType: targetType || undefined, page, pageSize: PAGE_SIZE });
      setItems(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load activity");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, targetType]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <PageHeader
        eyebrow="System"
        title="Audit Log"
        subtitle={`${total} recorded event${total === 1 ? "" : "s"} — admin, customer and device actions`}
      />

      <div className="toolbar">
        <select value={targetType} onChange={(e) => { setPage(1); setTargetType(e.target.value as AuditTargetType | ""); }}>
          <option value="">All types</option>
          <option value="Customer">Customers</option>
          <option value="License">Licenses</option>
          <option value="Device">Devices</option>
        </select>
      </div>

      {error && <ErrorBox message={error} />}
      {!error && items === null && <Loading />}
      {!error && items !== null && (
        <div className="card timeline-card">
          <ActivityList entries={items} />
        </div>
      )}

      {!error && items !== null && totalPages > 1 && (
        <div className="pagination">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
          <span>Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}
