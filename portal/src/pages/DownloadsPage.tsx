import { useEffect, useState } from "react";
import { listReleases } from "../api/releases";
import { ApiError } from "../api/client";
import type { PortalRelease } from "../types";
import { Loading, ErrorBox, EmptyState } from "../components/StateViews";

function formatSize(bytes: number | null): string {
  if (bytes === null) return "";
  const mb = bytes / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(1)} MB`;
}

const PRODUCT_LABELS: Record<PortalRelease["product"], string> = {
  "server-win": "Server (Windows)",
  android: "Android",
  ios: "iOS",
};

export function DownloadsPage() {
  const [items, setItems] = useState<PortalRelease[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listReleases()
      .then((result) => setItems(result.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load downloads"));
  }, []);

  return (
    <div>
      <div className="page-header">
        <h2>Downloads</h2>
      </div>

      {error && <ErrorBox message={error} />}
      {!error && items === null && <Loading />}
      {!error && items !== null && items.length === 0 && (
        <EmptyState label="Nothing available for your current plan yet." />
      )}

      {!error && items && items.length > 0 && (
        <div className="download-list">
          {items.map((release) => (
            <div key={release.id} className="download-row">
              <div>
                <div><strong>{PRODUCT_LABELS[release.product]}</strong> — {release.version}</div>
                <div className="muted">
                  {release.channel === "beta" && <span className="badge beta">beta</span>}{" "}
                  {formatSize(release.fileSize)}
                  {release.notes && <> · {release.notes}</>}
                </div>
              </div>
              {release.downloadUrl && (
                <a className="primary button-link" href={release.externalUrl ?? `${import.meta.env.VITE_API_BASE_URL}${release.downloadUrl}`} target="_blank" rel="noreferrer">
                  {release.externalUrl ? "Open store page" : "Download"}
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
