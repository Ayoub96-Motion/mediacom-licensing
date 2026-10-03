import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getLicense, revokeLicense, listActivations, deactivateActivation } from "../api/licenses";
import { ApiError } from "../api/client";
import type { LicenseActivation, LicenseWithDevices } from "../types";
import { Loading, ErrorBox } from "../components/StateViews";
import { Badge } from "../components/Badge";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { EditLicenseModal } from "../components/EditLicenseModal";
import { ActivityList } from "../components/ActivityList";
import { formatFeatureCount } from "../constants/tiers";
import { licenseAuditLog } from "../api/auditLog";
import type { AuditLogEntry } from "../types";
import { formatDaysUntil, isExpiringSoon } from "../lib/expiry";
import { BanIcon, ClockIcon, EditIcon, KeyIcon, MonitorIcon, UsersIcon } from "../components/Icons";

export function LicenseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [license, setLicense] = useState<LicenseWithDevices | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [deviceToDeactivate, setDeviceToDeactivate] = useState<LicenseActivation | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [activity, setActivity] = useState<AuditLogEntry[] | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);

  const [activations, setActivations] = useState<LicenseActivation[] | null>(null);
  const [activeCount, setActiveCount] = useState(0);
  const [activationsError, setActivationsError] = useState<string | null>(null);

  async function load() {
    if (!id) return;
    setError(null);
    try {
      const result = await getLicense(id);
      setLicense(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load license");
    }

    try {
      const log = await licenseAuditLog(id);
      setActivity(log.items);
    } catch (err) {
      setActivityError(err instanceof ApiError ? err.message : "Could not load activity");
    }

    try {
      const result = await listActivations(id);
      setActivations(result.items);
      setActiveCount(result.activeCount);
    } catch (err) {
      setActivationsError(err instanceof ApiError ? err.message : "Could not load devices");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleRevoke() {
    if (!id) return;
    setRevoking(true);
    setActionError(null);
    try {
      await revokeLicense(id);
      setShowRevokeConfirm(false);
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not revoke license");
    } finally {
      setRevoking(false);
    }
  }

  async function handleDeactivateDevice() {
    if (!deviceToDeactivate) return;
    setDeactivating(true);
    setActionError(null);
    try {
      await deactivateActivation(deviceToDeactivate.id);
      setDeviceToDeactivate(null);
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not deactivate device");
    } finally {
      setDeactivating(false);
    }
  }

  if (error) return <ErrorBox message={error} />;
  if (!license) return <Loading />;

  const f = license.features;

  return (
    <div>
      <div className="page-eyebrow"><Link to="/licenses">Licenses</Link> / Detail</div>

      <div className="card">
        <div className="entity-header">
          <span className="icon-badge dark" style={{ width: 52, height: 52, borderRadius: 16 }}><KeyIcon size={22} /></span>
          <div className="entity-main">
            <div className="entity-title">
              <h2>License</h2>
              <Badge value={license.status} />
              <Badge value={license.type} />
            </div>
            <div className="entity-meta">
              <span><Link to={`/customers/${license.customer.id}`}>{license.customer.name}</Link></span>
              <span>{license.customer.email}</span>
              <span className="mono">{license.id}</span>
            </div>
          </div>
          {license.status !== "revoked" && (
            <div className="page-actions">
              <button onClick={() => setShowEdit(true)}><EditIcon size={15} /> Edit</button>
              <button className="danger" onClick={() => setShowRevokeConfirm(true)}><BanIcon size={15} /> Revoke</button>
            </div>
          )}
        </div>
      </div>

      {actionError && <ErrorBox message={actionError} />}

      <div className="stat-cards three">
        <div className="stat-card">
          <div className="stat-top"><span className="icon-badge"><MonitorIcon /></span></div>
          {/* activeCount, not license.devices.length — that counts
              deactivated devices too, which don't hold a seat. */}
          <div className="stat-value">{activeCount}<small>/ {license.deviceLimit}</small></div>
          <div className="stat-label">Devices in use</div>
        </div>
        <div className="stat-card">
          <div className="stat-top"><span className="icon-badge neutral"><UsersIcon /></span></div>
          <div className="stat-value">{formatFeatureCount(f.maxUsers)}</div>
          <div className="stat-label">Max users</div>
        </div>
        <div className="stat-card">
          <div className="stat-top">
            <span className={`icon-badge ${isExpiringSoon(license.expiresAt, license.status) ? "warning" : "dark"}`}><ClockIcon /></span>
          </div>
          <div className="stat-value" style={{ fontSize: 22 }}>
            {license.expiresAt ? new Date(license.expiresAt).toLocaleDateString() : "Never"}
          </div>
          <div className="stat-label">{license.expiresAt ? formatDaysUntil(license.expiresAt) : "Perpetual"}</div>
        </div>
      </div>

      <div className="card">
        <h3>Details</h3>
        <div className="detail-grid">
          <div>
            <div className="kv-label">Status</div>
            <div className="kv-value"><Badge value={license.status} /></div>
          </div>
          <div>
            <div className="kv-label">Type</div>
            <div className="kv-value"><Badge value={license.type} /></div>
          </div>
          <div>
            <div className="kv-label">Device Limit</div>
            {/* activeCount, not license.devices.length — that counts
                deactivated devices too, which don't hold a seat. */}
            <div className="kv-value">{activeCount} / {license.deviceLimit}</div>
          </div>
          <div>
            <div className="kv-label">Expires</div>
            <div className="kv-value">
              {license.expiresAt ? (
                <>
                  {new Date(license.expiresAt).toLocaleDateString()}
                  {" — "}
                  <span className={isExpiringSoon(license.expiresAt, license.status) ? "expiry-warning" : undefined}>
                    {formatDaysUntil(license.expiresAt)}
                  </span>
                </>
              ) : (
                "Never (perpetual)"
              )}
            </div>
          </div>
          <div>
            <div className="kv-label">Issued</div>
            <div className="kv-value">{new Date(license.issuedAt).toLocaleDateString()}</div>
          </div>
          <div>
            <div className="kv-label">Last Updated</div>
            <div className="kv-value">{new Date(license.updatedAt).toLocaleDateString()}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Features</h3>
        <div className="detail-grid">
          <div>
            <div className="kv-label">Max Locations</div>
            <div className="kv-value">{formatFeatureCount(f.maxLocations)}</div>
          </div>
          <div>
            <div className="kv-label">Max Rooms / Location</div>
            <div className="kv-value">{formatFeatureCount(f.maxRoomsPerLocation)}</div>
          </div>
          <div>
            <div className="kv-label">Max Users</div>
            <div className="kv-value">{formatFeatureCount(f.maxUsers)}</div>
          </div>
          <div>
            <div className="kv-label">Guest Access</div>
            <div className="kv-value">{f.guestAccess ? "Yes" : "No"}</div>
          </div>
          <div>
            <div className="kv-label">Multi-Location Broadcast</div>
            <div className="kv-value">{f.multiLocationBroadcast ? "Yes" : "No"}</div>
          </div>
          <div>
            <div className="kv-label">White Label</div>
            <div className="kv-value">{f.whiteLabel ? "Yes" : "No"}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Devices: {activeCount} / {license.deviceLimit}</h3>
        {activationsError && <ErrorBox message={activationsError} />}
        {!activationsError && activations === null && <Loading />}
        {!activationsError && activations !== null && activations.length === 0 && (
          <p className="muted-text">No devices activated yet.</p>
        )}
        {!activationsError && activations !== null && activations.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Label</th>
                <th>Fingerprint</th>
                <th>Activated</th>
                <th>Last Seen</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {/* API already returns active-first, so this preserves that order. */}
              {activations.map((device) => (
                <tr key={device.id} className={device.status === "deactivated" ? "muted" : undefined}>
                  <td>
                    <Badge value={device.status} />
                    {device.status === "deactivated" && device.deactivatedAt && (
                      <div className="cell-sub">
                        {new Date(device.deactivatedAt).toLocaleDateString()}
                      </div>
                    )}
                  </td>
                  <td>
                    <div className="cell-with-icon">
                      <span className="icon-badge sm neutral"><MonitorIcon size={15} /></span>
                      <span className="cell-primary">{device.label || device.machineName || "Unnamed device"}</span>
                    </div>
                  </td>
                  <td className="cell-mono">{device.fingerprint}</td>
                  <td className="cell-mono">{new Date(device.activatedAt).toLocaleString()}</td>
                  <td className="cell-mono">{new Date(device.lastSeenAt).toLocaleString()}</td>
                  <td className="device-row-actions">
                    {device.status === "active" && (
                      <button className="danger" onClick={() => setDeviceToDeactivate(device)}>Deactivate</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card timeline-card">
        <h3>Activity</h3>
        {activityError && <ErrorBox message={activityError} />}
        {!activityError && activity === null && <Loading />}
        {!activityError && activity !== null && <ActivityList entries={activity} />}
      </div>

      {showRevokeConfirm && (
        <ConfirmDialog
          title="Revoke this license?"
          message="The customer will immediately lose access on all activated devices. This cannot be undone from the dashboard."
          confirmLabel="Revoke License"
          danger
          busy={revoking}
          onConfirm={handleRevoke}
          onCancel={() => setShowRevokeConfirm(false)}
        />
      )}

      {deviceToDeactivate && (
        <ConfirmDialog
          title="Deactivate this device?"
          message={`This frees a seat on the license. "${deviceToDeactivate.label || deviceToDeactivate.fingerprint}" will need to re-activate to use MediaCom again.`}
          confirmLabel="Deactivate"
          danger
          busy={deactivating}
          onConfirm={handleDeactivateDevice}
          onCancel={() => setDeviceToDeactivate(null)}
        />
      )}

      {showEdit && (
        <EditLicenseModal
          license={license}
          onCancel={() => setShowEdit(false)}
          onSaved={() => {
            setShowEdit(false);
            load();
          }}
        />
      )}
    </div>
  );
}
