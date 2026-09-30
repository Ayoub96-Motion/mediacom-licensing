import { useState, type FormEvent } from "react";
import { uploadRelease } from "../api/releases";
import { ApiError } from "../api/client";
import type { ReleaseChannel, ReleaseProduct, TierPresetName } from "../types";

interface UploadReleaseModalProps {
  onDone: () => void;
  onCancel: () => void;
}

const PRODUCTS: { value: ReleaseProduct; label: string; linkOnly: boolean }[] = [
  { value: "server-win", label: "Server (Windows)", linkOnly: false },
  { value: "android", label: "Android", linkOnly: true },
  { value: "ios", label: "iOS", linkOnly: true },
];

const TIERS: TierPresetName[] = ["starter", "studio", "enterprise"];

export function UploadReleaseModal({ onDone, onCancel }: UploadReleaseModalProps) {
  const [product, setProduct] = useState<ReleaseProduct>("server-win");
  const [version, setVersion] = useState("");
  const [channel, setChannel] = useState<ReleaseChannel>("stable");
  const [notes, setNotes] = useState("");
  const [minPlanCode, setMinPlanCode] = useState<TierPresetName | "">("");
  const [file, setFile] = useState<File | null>(null);
  const [externalUrl, setExternalUrl] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isLinkOnly = PRODUCTS.find((p) => p.value === product)!.linkOnly;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isLinkOnly && !file) {
      setError("Select a file to upload.");
      return;
    }
    if (isLinkOnly && !externalUrl.trim()) {
      setError("Enter a store URL.");
      return;
    }

    setProgress(0);
    try {
      const base = {
        product,
        version: version.trim(),
        channel,
        notes: notes.trim() || undefined,
        minPlanCode: minPlanCode || undefined,
      };
      await uploadRelease(
        isLinkOnly
          ? { ...base, product: product as "android" | "ios", externalUrl: externalUrl.trim() }
          : { ...base, product: "server-win", file: file! },
        (fraction) => setProgress(fraction)
      );
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed");
      setProgress(null);
    }
  }

  const busy = progress !== null;

  return (
    <div className="modal-overlay" onClick={busy ? undefined : onCancel}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h3>Upload Release</h3>
        {error && <div className="error-box">{error}</div>}

        <div className="field">
          <label>Product</label>
          <div className="tier-options">
            {PRODUCTS.map((p) => (
              <button
                type="button"
                key={p.value}
                className={product === p.value ? "selected" : ""}
                disabled={busy}
                onClick={() => setProduct(p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="version">Version</label>
            <input
              id="version" type="text" style={{ width: "100%" }}
              placeholder="1.4.2" value={version} disabled={busy}
              onChange={(e) => setVersion(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="channel">Channel</label>
            <select id="channel" style={{ width: "100%" }} value={channel} disabled={busy} onChange={(e) => setChannel(e.target.value as ReleaseChannel)}>
              <option value="stable">Stable</option>
              <option value="beta">Beta</option>
            </select>
          </div>
        </div>

        {isLinkOnly ? (
          <div className="field">
            <label htmlFor="externalUrl">Store URL</label>
            <input
              id="externalUrl" type="url" style={{ width: "100%" }}
              placeholder="https://play.google.com/store/apps/details?id=…"
              value={externalUrl} disabled={busy}
              onChange={(e) => setExternalUrl(e.target.value)}
              required
            />
          </div>
        ) : (
          <div className="field">
            <label htmlFor="file">Installer file</label>
            <input
              id="file" type="file" style={{ width: "100%" }} disabled={busy}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              required
            />
          </div>
        )}

        <div className="field">
          <label htmlFor="minPlanCode">Minimum plan (optional)</label>
          <select
            id="minPlanCode" style={{ width: "100%" }} value={minPlanCode} disabled={busy}
            onChange={(e) => setMinPlanCode(e.target.value as TierPresetName | "")}
          >
            <option value="">No restriction</option>
            {TIERS.map((t) => (
              <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="notes">Notes</label>
          <textarea
            id="notes" style={{ width: "100%" }} rows={3} disabled={busy}
            value={notes} onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {progress !== null && (
          <div className="progress-bar">
            <div className="progress-bar-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        )}

        <div className="modal-actions">
          <button type="button" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="submit" className="primary" disabled={busy}>
            {busy ? `Uploading… ${Math.round((progress ?? 0) * 100)}%` : "Upload"}
          </button>
        </div>
      </form>
    </div>
  );
}
