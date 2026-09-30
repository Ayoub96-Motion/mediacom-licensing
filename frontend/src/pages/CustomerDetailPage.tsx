import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getCustomer, listCustomerDevices } from "../api/customers";
import { apiRequest } from "../api/client";
import { ApiError } from "../api/client";
import { deactivateDevice } from "../api/licenses";
import type { Customer, CustomerWithLicenses, DeviceWithLicense } from "../types";
import { Loading, ErrorBox, EmptyState } from "../components/StateViews";
import { Badge } from "../components/Badge";
import { IssueLicenseModal } from "../components/IssueLicenseModal";
import { ActivityList } from "../components/ActivityList";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { summarizeFeatures } from "../constants/tiers";
import { customerAuditLog } from "../api/auditLog";
import type { AuditLogEntry } from "../types";

interface UpdateCustomerInput {
  name?: string;
  company?: string | null;
  email?: string;
  phone?: string | null;
}

function updateCustomer(id: string, input: UpdateCustomerInput): Promise<Customer> {
  return apiRequest<Customer>(`/admin/customers/${id}`, { method: "PATCH", body: input });
}

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<CustomerWithLicenses | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [showIssue, setShowIssue] = useState(false);

  // Edit form state
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [activity, setActivity] = useState<AuditLogEntry[] | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);

  const [devices, setDevices] = useState<DeviceWithLicense[] | null>(null);
  const [devicesError, setDevicesError] = useState<string | null>(null);
  const [deviceToDeactivate, setDeviceToDeactivate] = useState<DeviceWithLicense | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);

  async function load() {
    if (!id) return;
    setError(null);
    try {
      const result = await getCustomer(id);
      setCustomer(result);
      setName(result.name);
      setCompany(result.company || "");
      setEmail(result.email);
      setPhone(result.phone || "");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load customer");
    }

    try {
      const log = await customerAuditLog(id);
      setActivity(log.items);
    } catch (err) {
      setActivityError(err instanceof ApiError ? err.message : "Could not load activity");
    }

    try {
      setDevices(await listCustomerDevices(id));
    } catch (err) {
      setDevicesError(err instanceof ApiError ? err.message : "Could not load devices");
    }
  }

  async function handleDeactivateDevice() {
    if (!deviceToDeactivate) return;
    setDeactivating(true);
    setDeactivateError(null);
    try {
      // Same DELETE /admin/licenses/:id/devices/:deviceId call the License
      // detail page uses — reused directly, not reimplemented here.
      await deactivateDevice(deviceToDeactivate.licenseId, deviceToDeactivate.id);
      setDeviceToDeactivate(null);
      await load();
    } catch (err) {
      setDeactivateError(err instanceof ApiError ? err.message : "Could not deactivate device");
    } finally {
      setDeactivating(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setSaveError(null);
    setSaving(true);
    try {
      await updateCustomer(id, {
        name,
        company: company || null,
        email,
        phone: phone || null,
      });
      setEditing(false);
      await load();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Could not save changes");
    } finally {
      setSaving(false);
    }
  }

  if (error) return <ErrorBox message={error} />;
  if (!customer) return <Loading />;

  return (
    <div>
      <div className="page-header">
        <h2>{customer.name}</h2>
        <div style={{ display: "flex", gap: 8 }}>
          {!editing && <button onClick={() => setEditing(true)}>Edit</button>}
          <button className="primary" onClick={() => setShowIssue(true)}>+ New License</button>
        </div>
      </div>

      <div className="card">
        <h3>Customer Info</h3>
        {editing ? (
          <form onSubmit={handleSave}>
            {saveError && <div className="error-box">{saveError}</div>}
            <div className="field-row">
              <div className="field">
                <label htmlFor="edit-name">Name</label>
                <input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} required style={{ width: "100%" }} />
              </div>
              <div className="field">
                <label htmlFor="edit-company">Company</label>
                <input id="edit-company" value={company} onChange={(e) => setCompany(e.target.value)} style={{ width: "100%" }} />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label htmlFor="edit-email">Email</label>
                <input id="edit-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: "100%" }} />
              </div>
              <div className="field">
                <label htmlFor="edit-phone">Phone</label>
                <input id="edit-phone" value={phone} onChange={(e) => setPhone(e.target.value)} style={{ width: "100%" }} />
              </div>
            </div>
            <div className="modal-actions" style={{ justifyContent: "flex-start" }}>
              <button type="submit" className="primary" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
              <button type="button" onClick={() => setEditing(false)} disabled={saving}>Cancel</button>
            </div>
          </form>
        ) : (
          <div className="detail-grid">
            <div>
              <div className="kv-label">Company</div>
              <div className="kv-value">{customer.company || "—"}</div>
            </div>
            <div>
              <div className="kv-label">Email</div>
              <div className="kv-value">{customer.email}</div>
            </div>
            <div>
              <div className="kv-label">Phone</div>
              <div className="kv-value">{customer.phone || "—"}</div>
            </div>
            <div>
              <div className="kv-label">Customer Since</div>
              <div className="kv-value">{new Date(customer.createdAt).toLocaleDateString()}</div>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h3>Licenses</h3>
        {customer.licenses.length === 0 ? (
          <p style={{ fontSize: 13, color: "#6b7280" }}>No licenses yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Type</th>
                <th>Features</th>
                <th>Expires</th>
              </tr>
            </thead>
            <tbody>
              {customer.licenses.map((lic) => (
                <tr key={lic.id} className="clickable" onClick={() => navigate(`/licenses/${lic.id}`)}>
                  <td><Badge value={lic.status} /></td>
                  <td><Badge value={lic.type} /></td>
                  <td style={{ fontSize: 12, color: "#4b5563" }}>{summarizeFeatures(lic.features)}</td>
                  <td>{lic.expiresAt ? new Date(lic.expiresAt).toLocaleDateString() : "Never"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h3>Devices</h3>
        {deactivateError && <ErrorBox message={deactivateError} />}
        {devicesError && <ErrorBox message={devicesError} />}
        {!devicesError && devices === null && <Loading />}
        {!devicesError && devices !== null && devices.length === 0 && <EmptyState label="No devices activated on any license yet." />}
        {!devicesError && devices !== null && devices.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Device</th>
                <th>License</th>
                <th>Activated</th>
                <th>Last Seen</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {devices.map((device) => (
                <tr key={device.id}>
                  <td>
                    {device.label || <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12 }}>{device.fingerprint}</span>}
                  </td>
                  <td>
                    <Link to={`/licenses/${device.license.id}`}>
                      <Badge value={device.license.status} /> <span style={{ fontSize: 12 }}>{device.license.type}</span>
                    </Link>
                  </td>
                  <td>{new Date(device.activatedAt).toLocaleString()}</td>
                  <td>{new Date(device.lastSeenAt).toLocaleString()}</td>
                  <td className="device-row-actions">
                    <button onClick={() => setDeviceToDeactivate(device)}>Deactivate</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h3>Activity</h3>
        {activityError && <ErrorBox message={activityError} />}
        {!activityError && activity === null && <Loading />}
        {!activityError && activity !== null && <ActivityList entries={activity} />}
      </div>

      {deviceToDeactivate && (
        <ConfirmDialog
          title="Deactivate this device?"
          message={`This frees a seat on its license. "${deviceToDeactivate.label || deviceToDeactivate.fingerprint}" will need to re-activate to use MediaCom again.`}
          confirmLabel="Deactivate"
          danger
          busy={deactivating}
          onConfirm={handleDeactivateDevice}
          onCancel={() => setDeviceToDeactivate(null)}
        />
      )}

      {showIssue && (
        <IssueLicenseModal
          customer={customer}
          onCancel={() => setShowIssue(false)}
          onDone={() => {
            setShowIssue(false);
            load();
          }}
        />
      )}
    </div>
  );
}
