import { useEffect, useState } from "react";
import { listReleases } from "../api/releases";
import { ApiError } from "../api/client";
import type { PortalRelease } from "../types";
import { Loading, ErrorBox } from "./StateViews";
import { MonitorIcon, SmartphoneIcon, DownloadIcon, ExternalLinkIcon } from "./Icons";

function formatSize(bytes: number | null): string {
  if (bytes === null) return "";
  const mb = bytes / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(0)} MB`;
}

function releaseHref(release: PortalRelease): string {
  if (release.externalUrl) return release.externalUrl;
  if (release.downloadUrl) return `${import.meta.env.VITE_API_BASE_URL}${release.downloadUrl}`;
  return "#"; // TODO: no download/external URL published for this release yet
}

export function DownloadsSection() {
  const [items, setItems] = useState<PortalRelease[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listReleases()
      .then((result) => setItems(result.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load downloads"));
  }, []);

  if (error) return <ErrorBox message={error} />;
  if (items === null) return <Loading />;

  const desktop = items.find((r) => r.product === "server-win") ?? null;
  const ios = items.find((r) => r.product === "ios") ?? null;
  const android = items.find((r) => r.product === "android") ?? null;

  return (
    <section className="downloads-section">
      <div className="downloads-header">
        <h2>Downloads</h2>
        {/* Counts the two product cards always shown below (Desktop, Mobile),
            not how many have a published release yet — those without one
            still render with TODO placeholder links. */}
        <span className="apps-count-pill">2 apps</span>
      </div>

      <div className="downloads-grid">
        <div className="download-card">
          <div className="download-card-top">
            <span className="download-icon-badge download-icon-badge-lime">
              <MonitorIcon />
            </span>
            {desktop && <span className="version-pill">v{desktop.version}</span>}
          </div>
          <h3>MediaCom Desktop</h3>
          <p className="download-card-desc">
            Server manager for Windows — runs your intercom server, LiveKit and dashboard in one app.
          </p>
          {desktop ? (
            <a className="download-primary-button" href={releaseHref(desktop)} target="_blank" rel="noreferrer">
              <DownloadIcon /> Download for Windows
            </a>
          ) : (
            <a className="download-primary-button" href="#" aria-disabled="true">
              {/* TODO: no server-win release published yet */}
              <DownloadIcon /> Download for Windows
            </a>
          )}
          <div className="download-footnote">
            Windows 10/11 · 64-bit{desktop?.fileSize ? ` · ${formatSize(desktop.fileSize)}` : ""}
          </div>
        </div>

        <div className="download-card">
          <div className="download-card-top">
            <span className="download-icon-badge download-icon-badge-lime">
              <SmartphoneIcon />
            </span>
            <span className="version-pill">iOS · Android</span>
          </div>
          <h3>MediaCom Mobile</h3>
          <p className="download-card-desc">
            Push-to-talk intercom panel for iOS and Android. Scan the QR code or get it from the store.
          </p>
          <div className="download-outline-row">
            <a
              className="download-outline-button"
              href={ios ? releaseHref(ios) : "#"} // TODO: App Store URL not published yet
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLinkIcon /> App Store
            </a>
            <a
              className="download-outline-button"
              href={android ? releaseHref(android) : "#"} // TODO: Google Play URL not published yet
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLinkIcon /> Google Play
            </a>
          </div>
          <div className="download-footnote">Requires MediaCom Desktop running on the same network.</div>
        </div>
      </div>
    </section>
  );
}
