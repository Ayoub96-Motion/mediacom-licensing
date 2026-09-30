import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getStats } from "../api/stats";
import { ApiError } from "../api/client";
import type { DashboardStats } from "../types";
import { Loading, ErrorBox } from "../components/StateViews";
import { RecentActivityFeed } from "../components/RecentActivityFeed";

function StatCard({
  value,
  label,
  onClick,
  variant,
}: {
  value: number;
  label: string;
  onClick: () => void;
  variant?: "amber" | "red" | "green";
}) {
  return (
    <button className={`stat-card ${variant ?? ""}`} onClick={onClick}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </button>
  );
}

export function OverviewPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getStats()
      .then(setStats)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load dashboard stats"));
  }, []);

  return (
    <div>
      <div className="page-header">
        <h2>Overview</h2>
      </div>

      {error && <ErrorBox message={error} />}
      {!error && stats === null && <Loading />}

      {!error && stats !== null && (
        <>
          {stats.totalCustomers === 0 && stats.totalLicenses === 0 ? (
            <div className="card">
              <h3>Welcome to MediaCom Licensing</h3>
              <p style={{ fontSize: 13, color: "#6b7280" }}>
                No customers or licenses yet. Head to <Link to="/customers">Customers</Link> to add your first one.
              </p>
            </div>
          ) : (
            <>
              <div className="stat-cards">
                <StatCard value={stats.totalCustomers} label="Total Customers" onClick={() => navigate("/customers")} />
                <StatCard value={stats.totalLicenses} label="Total Licenses" onClick={() => navigate("/licenses")} />
                <StatCard
                  value={stats.licensesByStatus.active}
                  label="Active"
                  variant="green"
                  onClick={() => navigate("/licenses?status=active")}
                />
                <StatCard
                  value={stats.licensesByStatus.revoked}
                  label="Revoked"
                  variant="red"
                  onClick={() => navigate("/licenses?status=revoked")}
                />
                <StatCard
                  value={stats.licensesByStatus.expired}
                  label="Expired"
                  onClick={() => navigate("/licenses?status=expired")}
                />
                <StatCard
                  value={stats.licensesExpiringSoon}
                  label="Expiring Soon"
                  variant="amber"
                  onClick={() => navigate("/licenses?status=expiring_soon")}
                />
              </div>

              <div className="card">
                <h3>Recent Activity</h3>
                <RecentActivityFeed entries={stats.recentActivity} />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
