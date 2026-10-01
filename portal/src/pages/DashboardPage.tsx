import { useAuth } from "../context/AuthContext";
import { LicenseCard } from "../components/LicenseCard";
import { EmptyState } from "../components/StateViews";

export function DashboardPage() {
  const { customer, licenses } = useAuth();

  return (
    <div>
      <div className="page-header">
        <h2>My Licenses</h2>
      </div>
      {customer && <p className="muted">Signed in as {customer.name} ({customer.email})</p>}

      {licenses.length === 0 && <EmptyState label="No licenses on your account yet. Contact support if you believe this is a mistake." />}

      <div className="license-grid">
        {licenses.map((lic) => (
          <LicenseCard key={lic.id} license={lic} />
        ))}
      </div>
    </div>
  );
}
