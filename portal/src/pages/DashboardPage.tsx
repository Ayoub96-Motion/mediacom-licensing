import { useAuth } from "../context/AuthContext";
import { LicenseCard } from "../components/LicenseCard";
import { DownloadsSection } from "../components/DownloadsSection";
import { EmptyState } from "../components/StateViews";

export function DashboardPage() {
  const { customer, licenses } = useAuth();

  return (
    <div>
      <div className="dashboard-intro">
        <div className="dashboard-eyebrow">Dashboard</div>
        <h1>Welcome back{customer ? `, ${customer.name}` : ""}</h1>
        <p className="muted">Manage your license, devices, and app downloads.</p>
      </div>

      {licenses.length === 0 && <EmptyState label="No licenses on your account yet. Contact support if you believe this is a mistake." />}

      <div className="license-grid">
        {licenses.map((lic) => (
          <LicenseCard key={lic.id} license={lic} />
        ))}
      </div>

      <DownloadsSection />
    </div>
  );
}
