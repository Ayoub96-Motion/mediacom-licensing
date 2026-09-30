import { useState, type FormEvent } from "react";
import { createLicense } from "../api/licenses";
import { ApiError } from "../api/client";
import type { Customer, Entitlements, LicenseType, TierPresetName } from "../types";
import { TIER_PRESETS, summarizeFeatures } from "../constants/tiers";

interface IssueLicenseModalProps {
  customer: Customer;
  onDone: () => void;
  onCancel: () => void;
}

const TIERS: TierPresetName[] = ["starter", "studio", "enterprise"];

export function IssueLicenseModal({ customer, onDone, onCancel }: IssueLicenseModalProps) {
  const [tier, setTier] = useState<TierPresetName | "custom">("starter");
  const [customFeatures, setCustomFeatures] = useState<Entitlements>({
    maxLocations: 1,
    maxRoomsPerLocation: 1,
    maxUsers: 1,
    guestAccess: false,
    multiLocationBroadcast: false,
    whiteLabel: false,
  });
  const [deviceLimit, setDeviceLimit] = useState(1);
  const [type, setType] = useState<LicenseType>("perpetual");
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [rawKey, setRawKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await createLicense({
        customerId: customer.id,
        deviceLimit,
        type,
        expiresAt: type === "subscription" && expiresAt ? new Date(expiresAt).toISOString() : null,
        ...(tier === "custom" ? { features: customFeatures } : { tier }),
      });
      setRawKey(result.rawKey);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not issue license");
      setBusy(false);
    }
  }

  function updateCustomField<K extends keyof Entitlements>(key: K, value: Entitlements[K]) {
    setCustomFeatures((f) => ({ ...f, [key]: value }));
  }

  async function copyKey() {
    if (!rawKey) return;
    try {
      await navigator.clipboard.writeText(rawKey);
      setCopied(true);
    } catch {
      // clipboard API can fail (permissions, non-secure context) — the key
      // is still selectable/visible in the box, so this isn't fatal.
    }
  }

  // Step 2: the raw key result. Deliberately cannot be dismissed via the
  // overlay or Escape — only the explicit acknowledgment + Done button.
  if (rawKey) {
    return (
      <div className="modal-overlay">
        <div className="modal">
          <h3>License Created</h3>
          <div className="warning-box">
            This is the <strong>only time</strong> this raw license key will ever be shown. It has
            also been emailed to the customer, but there is no way to retrieve it again from this
            dashboard.
          </div>
          <div className="raw-key-box">{rawKey}</div>
          <button type="button" onClick={copyKey} style={{ width: "100%", marginBottom: 16 }}>
            {copied ? "Copied ✓" : "Copy to clipboard"}
          </button>
          <div className="checkbox-row">
            <input
              type="checkbox"
              id="ack"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
            />
            <label htmlFor="ack">I've copied this key and saved it somewhere safe</label>
          </div>
          <div className="modal-actions">
            <button type="button" className="primary" disabled={!acknowledged} onClick={onDone}>
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h3>Issue License — {customer.name}</h3>
        {error && <div className="error-box">{error}</div>}

        <div className="field">
          <label>Tier</label>
          <div className="tier-options">
            {TIERS.map((t) => (
              <button
                type="button"
                key={t}
                className={tier === t ? "selected" : ""}
                onClick={() => setTier(t)}
              >
                {t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
            <button type="button" className={tier === "custom" ? "selected" : ""} onClick={() => setTier("custom")}>
              Custom
            </button>
          </div>
          {tier !== "custom" && (
            <div className="feature-preview">{summarizeFeatures(TIER_PRESETS[tier])}</div>
          )}
        </div>

        {tier === "custom" && (
          <div className="card" style={{ boxShadow: "none", border: "1px solid #e5e7eb", padding: 14, marginBottom: 14 }}>
            <div className="field-row">
              <div className="field">
                <label htmlFor="f-locations">Max Locations</label>
                <input
                  id="f-locations" type="number" min={1} style={{ width: "100%" }}
                  value={customFeatures.maxLocations}
                  onChange={(e) => updateCustomField("maxLocations", Number(e.target.value))}
                />
              </div>
              <div className="field">
                <label htmlFor="f-rooms">Max Rooms / Location</label>
                <input
                  id="f-rooms" type="number" min={1} style={{ width: "100%" }}
                  value={customFeatures.maxRoomsPerLocation}
                  onChange={(e) => updateCustomField("maxRoomsPerLocation", Number(e.target.value))}
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="f-users">Max Users</label>
              <input
                id="f-users" type="number" min={1} style={{ width: "100%" }}
                value={customFeatures.maxUsers}
                onChange={(e) => updateCustomField("maxUsers", Number(e.target.value))}
              />
            </div>
            <div className="checkbox-row">
              <input
                type="checkbox" id="f-guest"
                checked={customFeatures.guestAccess}
                onChange={(e) => updateCustomField("guestAccess", e.target.checked)}
              />
              <label htmlFor="f-guest">Guest access</label>
            </div>
            <div className="checkbox-row">
              <input
                type="checkbox" id="f-broadcast"
                checked={customFeatures.multiLocationBroadcast}
                onChange={(e) => updateCustomField("multiLocationBroadcast", e.target.checked)}
              />
              <label htmlFor="f-broadcast">Multi-location broadcast</label>
            </div>
            <div className="checkbox-row">
              <input
                type="checkbox" id="f-whitelabel"
                checked={customFeatures.whiteLabel}
                onChange={(e) => updateCustomField("whiteLabel", e.target.checked)}
              />
              <label htmlFor="f-whitelabel">White label</label>
            </div>
          </div>
        )}

        <div className="field-row">
          <div className="field">
            <label htmlFor="deviceLimit">Device Limit</label>
            <input
              id="deviceLimit" type="number" min={1} style={{ width: "100%" }}
              value={deviceLimit}
              onChange={(e) => setDeviceLimit(Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label htmlFor="type">Type</label>
            <select id="type" style={{ width: "100%" }} value={type} onChange={(e) => setType(e.target.value as LicenseType)}>
              <option value="perpetual">Perpetual</option>
              <option value="subscription">Subscription</option>
            </select>
          </div>
        </div>

        {type === "subscription" && (
          <div className="field">
            <label htmlFor="expiresAt">Expires At</label>
            <input
              id="expiresAt" type="date" style={{ width: "100%" }}
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              required
            />
          </div>
        )}

        <div className="modal-actions">
          <button type="button" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="submit" className="primary" disabled={busy}>{busy ? "Issuing…" : "Issue License"}</button>
        </div>
      </form>
    </div>
  );
}
