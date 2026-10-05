import { useState } from "react";
import { revealKey, listDevices, deactivateDevice } from "../api/account";
import { requestMagicLink } from "../api/auth";
import { ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import type { PortalDevice, PortalLicense } from "../types";
import { UsersIcon, MapPinIcon, DeviceIcon } from "./Icons";

export function LicenseCard({ license }: { license: PortalLicense }) {
  const { customer } = useAuth();
  const [rawKey, setRawKey] = useState<string | null>(null);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [needsReauth, setNeedsReauth] = useState(false);
  const [reauthSent, setReauthSent] = useState(false);

  const [devicesOpen, setDevicesOpen] = useState(false);
  const [devices, setDevices] = useState<PortalDevice[] | null>(null);
  const [devicesError, setDevicesError] = useState<string | null>(null);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);

  async function handleReveal() {
    setRevealing(true);
    setKeyError(null);
    setNeedsReauth(false);
    try {
      const result = await revealKey(license.id);
      setRawKey(result.rawKey);
    } catch (err) {
      if (err instanceof ApiError && err.code === "REAUTH_REQUIRED") {
        setNeedsReauth(true);
      } else {
        setKeyError(err instanceof ApiError ? err.message : "Could not reveal key");
      }
    } finally {
      setRevealing(false);
    }
  }

  async function handleSendReauthLink() {
    if (!customer) return;
    await requestMagicLink(customer.email);
    setReauthSent(true);
  }

  async function copyKey() {
    if (!rawKey) return;
    try {
      await navigator.clipboard.writeText(rawKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API can fail (permissions, non-secure context) — the key
      // is still visible and selectable, so this isn't fatal.
    }
  }

  async function toggleDevices() {
    const opening = !devicesOpen;
    setDevicesOpen(opening);
    if (opening && devices === null) {
      setDevicesError(null);
      try {
        const result = await listDevices(license.id);
        setDevices(result.items);
      } catch (err) {
        setDevicesError(err instanceof ApiError ? err.message : "Could not load devices");
      }
    }
  }

  async function handleDeactivate(deviceId: string) {
    setDeactivatingId(deviceId);
    setDeactivateError(null);
    try {
      const updated = await deactivateDevice(license.id, deviceId);
      setDevices((prev) => prev?.map((d) => (d.id === updated.id ? { ...d, ...updated, status: "deactivated" } : d)) ?? prev);
    } catch (err) {
      setDeactivateError(err instanceof ApiError ? err.message : "Could not deactivate device");
    } finally {
      setDeactivatingId(null);
    }
  }

  return (
    <div className="license-card">
      <div className="license-card-header">
        <div>
          <span className="badge">{license.planCode ?? "custom"}</span>{" "}
          <span className={`badge ${license.status}`}>{license.status}</span>
        </div>
        <div className="muted">
          {license.expiresAt ? `Expires ${new Date(license.expiresAt).toLocaleDateString()}` : "Never expires"}
        </div>
      </div>

      <div className="license-card-body">
        <div className="stat-block-row">
          <div className="stat-block">
            <span className="stat-icon-badge stat-icon-badge-lime">
              <UsersIcon />
            </span>
            <div>
              <div className="stat-value">{license.features.maxUsers}</div>
              <div className="stat-label">users</div>
            </div>
          </div>
          <div className="stat-block">
            <span className="stat-icon-badge stat-icon-badge-lime">
              <MapPinIcon />
            </span>
            <div>
              <div className="stat-value">{license.features.maxLocations}</div>
              <div className="stat-label">location{license.features.maxLocations === 1 ? "" : "s"}</div>
            </div>
          </div>
          <div className="stat-block">
            <span className="stat-icon-badge stat-icon-badge-neutral">
              <DeviceIcon />
            </span>
            <div>
              <div className="stat-value">
                {license.activeDeviceCount}<span className="stat-value-sub">/{license.deviceLimit}</span>
              </div>
              <div className="stat-label">devices</div>
            </div>
          </div>
        </div>

        <div className="key-box">
          {rawKey ? (
            <>
              <code>{rawKey}</code>
              <button type="button" onClick={copyKey}>{copied ? "Copied ✓" : "Copy"}</button>
            </>
          ) : (
            <>
              <code>•••• •••• •••• ••••</code>
              {license.keyAvailable ? (
                <button type="button" onClick={handleReveal} disabled={revealing}>
                  {revealing ? "Revealing…" : "Reveal"}
                </button>
              ) : (
                <span className="muted">Contact support to retrieve this key</span>
              )}
            </>
          )}
        </div>
        {keyError && <div className="error-box">{keyError}</div>}
        {needsReauth && (
          <div className="error-box">
            For your security, revealing a key needs a recent login.{" "}
            {reauthSent ? (
              "A new login link has been sent — click it, then try again."
            ) : (
              <button type="button" className="link" onClick={handleSendReauthLink}>Send a new login link</button>
            )}
          </div>
        )}

        <button type="button" className="link manage-devices-link" onClick={toggleDevices}>
          <DeviceIcon width={14} height={14} />
          {devicesOpen ? "Hide devices" : "Manage devices"}
        </button>

        {devicesOpen && (
          <div className="device-list">
            {devicesError && <div className="error-box">{devicesError}</div>}
            {deactivateError && <div className="error-box">{deactivateError}</div>}
            {devices === null && !devicesError && <div className="muted">Loading devices…</div>}
            {devices?.length === 0 && <div className="muted">No devices activated yet.</div>}
            {devices?.map((d) => (
              <div key={d.id} className={`device-row ${d.status === "deactivated" ? "muted" : ""}`}>
                <div>
                  <div>{d.machineName || d.label || "Unnamed device"}</div>
                  <div className="muted" style={{ fontSize: 11 }}>
                    Activated {new Date(d.activatedAt).toLocaleDateString()} · last seen {new Date(d.lastSeenAt).toLocaleDateString()}
                  </div>
                </div>
                {d.status === "active" ? (
                  <button
                    type="button"
                    disabled={deactivatingId === d.id}
                    onClick={() => handleDeactivate(d.id)}
                  >
                    {deactivatingId === d.id ? "Deactivating…" : "Deactivate"}
                  </button>
                ) : (
                  <span className="badge deactivated">deactivated</span>
                )}
              </div>
            ))}
            <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>
              You can deactivate up to 3 devices per 30 days on this license. Need more? Contact support.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
