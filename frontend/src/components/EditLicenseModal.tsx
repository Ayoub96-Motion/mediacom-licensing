import { useState, type FormEvent } from "react";
import { updateLicense } from "../api/licenses";
import { ApiError } from "../api/client";
import type { Entitlements, License, LicenseType } from "../types";

interface EditLicenseModalProps {
  license: License;
  onSaved: (updated: License) => void;
  onCancel: () => void;
}

export function EditLicenseModal({ license, onSaved, onCancel }: EditLicenseModalProps) {
  const [features, setFeatures] = useState<Entitlements>(license.features);
  const [deviceLimit, setDeviceLimit] = useState(license.deviceLimit);
  const [type, setType] = useState<LicenseType>(license.type);
  const [expiresAt, setExpiresAt] = useState(license.expiresAt ? license.expiresAt.slice(0, 10) : "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function updateField<K extends keyof Entitlements>(key: K, value: Entitlements[K]) {
    setFeatures((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const updated = await updateLicense(license.id, {
        features,
        deviceLimit,
        type,
        expiresAt: type === "subscription" ? (expiresAt ? new Date(expiresAt).toISOString() : null) : null,
      });
      onSaved(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update license");
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h3>Edit License</h3>
        {error && <div className="error-box">{error}</div>}

        <div className="field-row">
          <div className="field">
            <label htmlFor="e-locations">Max Locations</label>
            <input id="e-locations" type="number" min={1} style={{ width: "100%" }} value={features.maxLocations} onChange={(e) => updateField("maxLocations", Number(e.target.value))} />
          </div>
          <div className="field">
            <label htmlFor="e-rooms">Max Rooms / Location</label>
            <input id="e-rooms" type="number" min={1} style={{ width: "100%" }} value={features.maxRoomsPerLocation} onChange={(e) => updateField("maxRoomsPerLocation", Number(e.target.value))} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="e-users">Max Users</label>
          <input id="e-users" type="number" min={1} style={{ width: "100%" }} value={features.maxUsers} onChange={(e) => updateField("maxUsers", Number(e.target.value))} />
        </div>
        <div className="checkbox-row">
          <input type="checkbox" id="e-guest" checked={features.guestAccess} onChange={(e) => updateField("guestAccess", e.target.checked)} />
          <label htmlFor="e-guest">Guest access</label>
        </div>
        <div className="checkbox-row">
          <input type="checkbox" id="e-broadcast" checked={features.multiLocationBroadcast} onChange={(e) => updateField("multiLocationBroadcast", e.target.checked)} />
          <label htmlFor="e-broadcast">Multi-location broadcast</label>
        </div>
        <div className="checkbox-row">
          <input type="checkbox" id="e-whitelabel" checked={features.whiteLabel} onChange={(e) => updateField("whiteLabel", e.target.checked)} />
          <label htmlFor="e-whitelabel">White label</label>
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="e-devicelimit">Device Limit</label>
            <input id="e-devicelimit" type="number" min={1} style={{ width: "100%" }} value={deviceLimit} onChange={(e) => setDeviceLimit(Number(e.target.value))} />
          </div>
          <div className="field">
            <label htmlFor="e-type">Type</label>
            <select id="e-type" style={{ width: "100%" }} value={type} onChange={(e) => setType(e.target.value as LicenseType)}>
              <option value="perpetual">Perpetual</option>
              <option value="subscription">Subscription</option>
            </select>
          </div>
        </div>

        {type === "subscription" && (
          <div className="field">
            <label htmlFor="e-expires">Expires At</label>
            <input id="e-expires" type="date" style={{ width: "100%" }} value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </div>
        )}

        <div className="modal-actions">
          <button type="button" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="submit" className="primary" disabled={busy}>{busy ? "Saving…" : "Save Changes"}</button>
        </div>
      </form>
    </div>
  );
}
