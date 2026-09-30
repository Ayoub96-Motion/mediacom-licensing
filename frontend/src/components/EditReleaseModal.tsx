import { useState, type FormEvent } from "react";
import { updateRelease } from "../api/releases";
import { ApiError } from "../api/client";
import type { Release, ReleaseChannel, TierPresetName } from "../types";

interface EditReleaseModalProps {
  release: Release;
  onSaved: (updated: Release) => void;
  onCancel: () => void;
}

const TIERS: TierPresetName[] = ["starter", "studio", "enterprise"];

export function EditReleaseModal({ release, onSaved, onCancel }: EditReleaseModalProps) {
  const [channel, setChannel] = useState<ReleaseChannel>(release.channel);
  const [notes, setNotes] = useState(release.notes ?? "");
  const [minPlanCode, setMinPlanCode] = useState<TierPresetName | "">(release.minPlanCode ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const updated = await updateRelease(release.id, {
        channel,
        notes: notes.trim() || null,
        minPlanCode: minPlanCode || null,
      });
      onSaved(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update release");
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h3>Edit Release — {release.product} {release.version}</h3>
        {error && <div className="error-box">{error}</div>}

        <div className="field">
          <label htmlFor="channel">Channel</label>
          <select id="channel" style={{ width: "100%" }} value={channel} onChange={(e) => setChannel(e.target.value as ReleaseChannel)}>
            <option value="stable">Stable</option>
            <option value="beta">Beta</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="minPlanCode">Minimum plan</label>
          <select
            id="minPlanCode" style={{ width: "100%" }} value={minPlanCode}
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
            id="notes" style={{ width: "100%" }} rows={4}
            value={notes} onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="modal-actions">
          <button type="button" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="submit" className="primary" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </div>
  );
}
