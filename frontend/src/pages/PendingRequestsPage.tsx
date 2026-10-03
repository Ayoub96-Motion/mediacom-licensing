import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listCustomers } from "../api/customers";
import { ApiError } from "../api/client";
import type { CustomerListItem } from "../types";
import { Loading, ErrorBox, EmptyState } from "../components/StateViews";
import { IssueLicenseModal } from "../components/IssueLicenseModal";
import { PageHeader } from "../components/PageHeader";
import { SearchIcon } from "../components/Icons";
import { TIER_FOR_TEAM_SIZE } from "../lib/teamSize";

const PAGE_SIZE = 20;

/**
 * Request-access signups from the public landing page (status "pending").
 * Approving one = issuing its first license through the usual
 * IssueLicenseModal — the backend flips the customer to "active" as part of
 * that same POST /admin/licenses call, so it drops off this list on reload.
 */
export function PendingRequestsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<CustomerListItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState<CustomerListItem | null>(null);

  async function load() {
    setError(null);
    try {
      const result = await listCustomers({ status: "pending", q: search || undefined, page, pageSize: PAGE_SIZE });
      setItems(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load pending requests");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <PageHeader
        eyebrow="Customers"
        title="Pending Requests"
        subtitle="Access requests from the public signup form, waiting for a license"
      />

      <div className="toolbar">
        <label className="search-input" style={{ margin: 0 }}>
        <SearchIcon size={16} />
        <input
          type="text"
          aria-label="Search"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
        />
        </label>
      </div>

      {error && <ErrorBox message={error} />}
      {!error && items === null && <Loading />}
      {!error && items !== null && items.length === 0 && <EmptyState label="No pending access requests." />}

      {!error && items !== null && items.length > 0 && (
        <>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Company</th>
                <th>Email</th>
                <th>Team Size</th>
                <th>Requested</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} className="clickable" onClick={() => navigate(`/customers/${c.id}`)}>
                  <td>
                    <div className="cell-with-icon">
                      <span className="avatar">{c.name.charAt(0).toUpperCase()}</span>
                      <span className="cell-primary">{c.name}</span>
                    </div>
                  </td>
                  <td>{c.company || "—"}</td>
                  <td className="muted-text">{c.email}</td>
                  <td>{c.teamSize ? <span className="badge">{c.teamSize}</span> : "—"}</td>
                  <td className="cell-mono">{new Date(c.createdAt).toLocaleDateString()}</td>
                  <td className="row-actions">
                    <button
                      className="primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        setApproving(c);
                      }}
                    >
                      Approve → Issue License
                    </button>
                  </td>
                </tr>
              ))}
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

      {approving && (
        <IssueLicenseModal
          customer={approving}
          initialTier={approving.teamSize ? TIER_FOR_TEAM_SIZE[approving.teamSize] : undefined}
          onCancel={() => setApproving(null)}
          onDone={() => {
            setApproving(null);
            load();
          }}
        />
      )}
    </div>
  );
}
