import { useEffect, useState } from "react";
import { listReleases, updateRelease, deleteRelease } from "../api/releases";
import { ApiError } from "../api/client";
import type { Release, ReleaseProduct } from "../types";
import { Loading, ErrorBox, EmptyState } from "../components/StateViews";
import { Badge } from "../components/Badge";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { UploadReleaseModal } from "../components/UploadReleaseModal";
import { EditReleaseModal } from "../components/EditReleaseModal";

const PAGE_SIZE = 20;

function formatSize(bytes: number | null): string {
  if (bytes === null) return "—";
  const mb = bytes / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(1)} MB`;
}

export function ReleasesPage() {
  const [items, setItems] = useState<Release[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [product, setProduct] = useState<ReleaseProduct | "">("");
  const [error, setError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [editing, setEditing] = useState<Release | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Release | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const result = await listReleases({ product: product || undefined, page, pageSize: PAGE_SIZE });
      setItems(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load releases");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, product]);

  async function togglePublish(release: Release) {
    setBusyId(release.id);
    try {
      const updated = await updateRelease(release.id, { isPublished: !release.isPublished });
      setItems((prev) => prev?.map((r) => (r.id === updated.id ? updated : r)) ?? prev);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update release");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    setBusyId(confirmDelete.id);
    try {
      await deleteRelease(confirmDelete.id);
      setConfirmDelete(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete release");
    } finally {
      setBusyId(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div className="page-header">
        <h2>Releases</h2>
        <button className="primary" onClick={() => setShowUpload(true)}>Upload Release</button>
      </div>

      <div className="toolbar">
        <select value={product} onChange={(e) => { setPage(1); setProduct(e.target.value as ReleaseProduct | ""); }}>
          <option value="">All products</option>
          <option value="server-win">Server (Windows)</option>
          <option value="android">Android</option>
          <option value="ios">iOS</option>
        </select>
      </div>

      {error && <ErrorBox message={error} />}
      {!error && items === null && <Loading />}
      {!error && items !== null && items.length === 0 && <EmptyState label="No releases yet." />}

      {!error && items && items.length > 0 && (
        <>
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Version</th>
                <th>Channel</th>
                <th>Size</th>
                <th>SHA-256</th>
                <th>Published</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((release) => (
                <tr key={release.id}>
                  <td>{release.product}</td>
                  <td>{release.version}</td>
                  <td><Badge value={release.channel} /></td>
                  <td>{release.externalUrl ? "link" : formatSize(release.fileSize)}</td>
                  <td style={{ fontFamily: "monospace", fontSize: 11 }}>
                    {release.sha256 ? `${release.sha256.slice(0, 10)}…` : "—"}
                  </td>
                  <td>
                    <button
                      className={release.isPublished ? "" : "primary"}
                      disabled={busyId === release.id}
                      onClick={() => togglePublish(release)}
                    >
                      {release.isPublished ? "Unpublish" : "Publish"}
                    </button>
                  </td>
                  <td>{new Date(release.createdAt).toLocaleDateString()}</td>
                  <td>
                    <button onClick={() => setEditing(release)}>Edit</button>{" "}
                    <button
                      disabled={release.isPublished || busyId === release.id}
                      title={release.isPublished ? "Unpublish before deleting" : undefined}
                      onClick={() => setConfirmDelete(release)}
                    >
                      Delete
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

      {showUpload && (
        <UploadReleaseModal
          onDone={() => { setShowUpload(false); load(); }}
          onCancel={() => setShowUpload(false)}
        />
      )}

      {editing && (
        <EditReleaseModal
          release={editing}
          onSaved={(updated) => {
            setItems((prev) => prev?.map((r) => (r.id === updated.id ? updated : r)) ?? prev);
            setEditing(null);
          }}
          onCancel={() => setEditing(null)}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete release"
          message={`Delete ${confirmDelete.product} ${confirmDelete.version}? This also removes the uploaded file, if any.`}
          confirmLabel="Delete"
          danger
          busy={busyId === confirmDelete.id}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
