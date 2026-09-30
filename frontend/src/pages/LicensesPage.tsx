import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { listLicenses, getExpiringSoonCount } from "../api/licenses";
import { ApiError } from "../api/client";
import type { LicenseStatusFilter, LicenseType, LicenseWithCustomer } from "../types";
import { Loading, ErrorBox, EmptyState } from "../components/StateViews";
import { Badge } from "../components/Badge";
import { summarizeFeatures } from "../constants/tiers";
import { isExpiringSoon, EXPIRING_SOON_DAYS } from "../lib/expiry";

const PAGE_SIZE = 20;
const VALID_STATUSES: LicenseStatusFilter[] = ["active", "revoked", "expired", "expiring_soon"];

export function LicensesPage() {
  const navigate = useNavigate();
  // Reads an initial ?status= from the URL — e.g. the Overview page's stat
  // cards link here with a filter pre-applied (/licenses?status=revoked)
  // rather than just displaying a static number.
  const [searchParams] = useSearchParams();
  const initialStatus = searchParams.get("status");
  const [items, setItems] = useState<LicenseWithCustomer[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<LicenseStatusFilter | "">(
    initialStatus && (VALID_STATUSES as string[]).includes(initialStatus) ? (initialStatus as LicenseStatusFilter) : ""
  );
  const [type, setType] = useState<LicenseType | "">("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [expiringSoonCount, setExpiringSoonCount] = useState<number | null>(null);

  async function load() {
    setError(null);
    try {
      const result = await listLicenses({
        status: status || undefined,
        type: type || undefined,
        page,
        pageSize: PAGE_SIZE,
      });
      setItems(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load licenses");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status, type]);

  useEffect(() => {
    getExpiringSoonCount(EXPIRING_SOON_DAYS)
      .then((r) => setExpiringSoonCount(r.count))
      .catch(() => setExpiringSoonCount(null)); // summary widget failing silently is fine — the list/filter below is the real feature
  }, []);

  // The API has no server-side "search by customer name" filter — this only
  // narrows the currently loaded page's results, not the full dataset across
  // pages. Good enough for an internal tool at this scale; flagged in the
  // README/build notes as a known limitation, not silently pretended away.
  const visibleItems = useMemo(() => {
    if (!items || !customerFilter.trim()) return items;
    const q = customerFilter.trim().toLowerCase();
    return items.filter(
      (lic) => lic.customer.name.toLowerCase().includes(q) || lic.customer.email.toLowerCase().includes(q)
    );
  }, [items, customerFilter]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div className="page-header">
        <h2>Licenses</h2>
      </div>

      {expiringSoonCount !== null && (
        <div className={`stat-banner ${expiringSoonCount === 0 ? "quiet" : ""}`}>
          {expiringSoonCount === 0
            ? `No licenses expiring in the next ${EXPIRING_SOON_DAYS} days.`
            : `⚠ ${expiringSoonCount} license${expiringSoonCount === 1 ? "" : "s"} expiring in the next ${EXPIRING_SOON_DAYS} days.`}
          {expiringSoonCount > 0 && (
            <button
              className="link"
              style={{ marginLeft: "auto" }}
              onClick={() => { setPage(1); setStatus("expiring_soon"); }}
            >
              View them
            </button>
          )}
        </div>
      )}

      <div className="toolbar">
        <input
          type="text"
          placeholder="Filter loaded page by customer name/email…"
          value={customerFilter}
          onChange={(e) => setCustomerFilter(e.target.value)}
        />
        <select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value as LicenseStatusFilter | ""); }}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="revoked">Revoked</option>
          <option value="expired">Expired</option>
          <option value="expiring_soon">Expiring Soon</option>
        </select>
        <select value={type} onChange={(e) => { setPage(1); setType(e.target.value as LicenseType | ""); }}>
          <option value="">All types</option>
          <option value="perpetual">Perpetual</option>
          <option value="subscription">Subscription</option>
        </select>
      </div>

      {error && <ErrorBox message={error} />}
      {!error && items === null && <Loading />}
      {!error && items !== null && visibleItems!.length === 0 && <EmptyState label="No licenses found." />}

      {!error && visibleItems && visibleItems.length > 0 && (
        <>
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Status</th>
                <th>Type</th>
                <th>Features</th>
                <th>Devices</th>
                <th>Expires</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((lic) => {
                const expiringSoon = isExpiringSoon(lic.expiresAt, lic.status);
                return (
                  <tr key={lic.id} className="clickable" onClick={() => navigate(`/licenses/${lic.id}`)}>
                    <td>
                      <div>{lic.customer.name}</div>
                      <div style={{ fontSize: 11, color: "#9ca3af" }}>{lic.customer.email}</div>
                    </td>
                    <td><Badge value={lic.status} /></td>
                    <td><Badge value={lic.type} /></td>
                    <td style={{ fontSize: 12, color: "#4b5563" }}>{summarizeFeatures(lic.features)}</td>
                    <td>{lic.deviceLimit} max</td>
                    <td>
                      {lic.expiresAt ? (
                        expiringSoon ? (
                          <span className="badge expiring-soon">{new Date(lic.expiresAt).toLocaleDateString()}</span>
                        ) : (
                          new Date(lic.expiresAt).toLocaleDateString()
                        )
                      ) : (
                        "Never"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="pagination">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
              <span>Page {page} of {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
