import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listCustomers } from "../api/customers";
import { ApiError } from "../api/client";
import type { CustomerListItem } from "../types";
import { Loading, ErrorBox, EmptyState } from "../components/StateViews";
import { AddCustomerModal } from "../components/AddCustomerModal";

const PAGE_SIZE = 20;

export function CustomersPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<CustomerListItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  async function load() {
    setError(null);
    try {
      const result = await listCustomers({ q: search || undefined, page, pageSize: PAGE_SIZE });
      setItems(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load customers");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div className="page-header">
        <h2>Customers</h2>
        <button className="primary" onClick={() => setShowAdd(true)}>+ Add Customer</button>
      </div>

      <div className="toolbar">
        <input
          type="text"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
        />
      </div>

      {error && <ErrorBox message={error} />}
      {!error && items === null && <Loading />}
      {!error && items !== null && items.length === 0 && <EmptyState label="No customers found." />}

      {!error && items !== null && items.length > 0 && (
        <>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Company</th>
                <th>Email</th>
                <th># Licenses</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} className="clickable" onClick={() => navigate(`/customers/${c.id}`)}>
                  <td>{c.name}</td>
                  <td>{c.company || "—"}</td>
                  <td>{c.email}</td>
                  <td>{c.licenseCount}</td>
                  <td>{new Date(c.createdAt).toLocaleDateString()}</td>
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

      {showAdd && (
        <AddCustomerModal
          onCancel={() => setShowAdd(false)}
          onCreated={(customer) => {
            setShowAdd(false);
            navigate(`/customers/${customer.id}`);
          }}
        />
      )}
    </div>
  );
}
