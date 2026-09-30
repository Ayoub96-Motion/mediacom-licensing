import { useState, type FormEvent } from "react";
import { createCustomer } from "../api/customers";
import { ApiError } from "../api/client";
import type { Customer } from "../types";

interface AddCustomerModalProps {
  onCreated: (customer: Customer) => void;
  onCancel: () => void;
}

export function AddCustomerModal({ onCreated, onCancel }: AddCustomerModalProps) {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const customer = await createCustomer({
        name,
        email,
        company: company || undefined,
        phone: phone || undefined,
      });
      onCreated(customer);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create customer");
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h3>Add Customer</h3>
        {error && <div className="error-box">{error}</div>}
        <div className="field">
          <label htmlFor="c-name">Name</label>
          <input id="c-name" value={name} onChange={(e) => setName(e.target.value)} required style={{ width: "100%" }} autoFocus />
        </div>
        <div className="field">
          <label htmlFor="c-company">Company</label>
          <input id="c-company" value={company} onChange={(e) => setCompany(e.target.value)} style={{ width: "100%" }} />
        </div>
        <div className="field">
          <label htmlFor="c-email">Email</label>
          <input id="c-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: "100%" }} />
        </div>
        <div className="field">
          <label htmlFor="c-phone">Phone</label>
          <input id="c-phone" value={phone} onChange={(e) => setPhone(e.target.value)} style={{ width: "100%" }} />
        </div>
        <div className="modal-actions">
          <button type="button" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="submit" className="primary" disabled={busy}>{busy ? "Creating…" : "Create Customer"}</button>
        </div>
      </form>
    </div>
  );
}
