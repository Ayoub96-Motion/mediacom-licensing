import { useEffect, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getStats } from "../api/stats";
import { listCustomers } from "../api/customers";
import { ApiError } from "../api/client";
import type { CustomerListItem, DashboardStats } from "../types";
import { Loading, ErrorBox, EmptyState } from "../components/StateViews";
import { RecentActivityFeed } from "../components/RecentActivityFeed";
import { IssueLicenseModal } from "../components/IssueLicenseModal";
import { PageHeader } from "../components/PageHeader";
import { AlertIcon, CheckCircleIcon, KeyIcon, UserPlusIcon, UsersIcon } from "../components/Icons";
import { TIER_FOR_TEAM_SIZE } from "../lib/teamSize";

const PENDING_PREVIEW = 5;

function StatCard({
  icon,
  iconTone,
  value,
  label,
  tag,
  onClick,
}: {
  icon: ReactNode;
  iconTone?: "warning" | "neutral";
  value: number;
  label: string;
  tag?: ReactNode;
  onClick: () => void;
}) {
  // A div with role="link" rather than a <button> — the tag in the corner
  // can itself be a link (e.g. to the revoked filter), and interactive
  // content can't nest inside a button.
  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  }
  return (
    <div className="stat-card" role="link" tabIndex={0} onClick={onClick} onKeyDown={onKeyDown}>
      <div className="stat-top">
        <span className={`icon-badge ${iconTone ?? ""}`}>{icon}</span>
        {tag}
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

export function OverviewPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<CustomerListItem[] | null>(null);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [approving, setApproving] = useState<CustomerListItem | null>(null);

  function loadStats() {
    getStats()
      .then(setStats)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load dashboard stats"));
  }

  function loadPending() {
    // Same listCustomers({status:"pending"}) call the Pending Requests page
    // makes — a panel failing to load just hides itself; the page is the
    // real feature.
    listCustomers({ status: "pending", page: 1, pageSize: PENDING_PREVIEW })
      .then((r) => {
        setPending(r.items);
        setPendingTotal(r.total);
      })
      .catch(() => setPending(null));
  }

  useEffect(() => {
    loadStats();
    loadPending();
  }, []);

  const stopNav = (e: MouseEvent) => e.stopPropagation();

  return (
    <div>
      <PageHeader eyebrow="Dashboard" title="Overview" subtitle="Customers, licenses and recent activity at a glance" />

      {error && <ErrorBox message={error} />}
      {!error && stats === null && <Loading />}

      {!error && stats !== null && (
        <>
          {stats.totalCustomers === 0 && stats.totalLicenses === 0 && pendingTotal === 0 ? (
            <div className="card">
              <h3>Welcome to MediaCom Licensing</h3>
              <p className="muted-text">
                No customers or licenses yet. Head to <Link to="/customers">Customers</Link> to add your first one.
              </p>
            </div>
          ) : (
            <>
              <div className="stat-cards">
                <StatCard
                  icon={<UsersIcon />}
                  value={stats.totalCustomers}
                  label="Total Customers"
                  tag={
                    pendingTotal > 0 ? (
                      <Link to="/pending-requests" className="trend-tag lime" onClick={stopNav}>{pendingTotal} pending</Link>
                    ) : undefined
                  }
                  onClick={() => navigate("/customers")}
                />
                <StatCard
                  icon={<KeyIcon />}
                  iconTone="neutral"
                  value={stats.totalLicenses}
                  label="Total Licenses"
                  tag={
                    stats.licensesByStatus.revoked > 0 ? (
                      <Link to="/licenses?status=revoked" className="trend-tag warning" onClick={stopNav}>
                        {stats.licensesByStatus.revoked} revoked
                      </Link>
                    ) : undefined
                  }
                  onClick={() => navigate("/licenses")}
                />
                <StatCard
                  icon={<CheckCircleIcon />}
                  value={stats.licensesByStatus.active}
                  label="Active Licenses"
                  tag={
                    stats.licensesByStatus.expired > 0 ? (
                      <Link to="/licenses?status=expired" className="trend-tag" onClick={stopNav}>
                        {stats.licensesByStatus.expired} expired
                      </Link>
                    ) : undefined
                  }
                  onClick={() => navigate("/licenses?status=active")}
                />
                <StatCard
                  icon={<AlertIcon />}
                  iconTone="warning"
                  value={stats.licensesExpiringSoon}
                  label="Expiring Soon"
                  tag={<span className={`trend-tag ${stats.licensesExpiringSoon > 0 ? "warning" : ""}`}>30 days</span>}
                  onClick={() => navigate("/licenses?status=expiring_soon")}
                />
              </div>

              <div className="dashboard-columns">
                <div className="card timeline-card">
                  <div className="card-header">
                    <h3>Recent activity</h3>
                    <Link to="/activity" className="mono" style={{ fontSize: 12 }}>Full audit log →</Link>
                  </div>
                  <RecentActivityFeed entries={stats.recentActivity} />
                </div>

                {pending !== null && (
                  <div className={`card ${pending.length > 0 ? "highlight" : ""}`}>
                    <div className="card-header">
                      <h3>
                        Pending requests <span className="count-pill">{pendingTotal}</span>
                      </h3>
                      <span className="icon-badge sm"><UserPlusIcon size={16} /></span>
                    </div>
                    {pending.length === 0 ? (
                      <EmptyState label="No access requests waiting." />
                    ) : (
                      <>
                        {pending.map((c) => (
                          <div key={c.id} className="panel-row">
                            <span className="avatar">{c.name.charAt(0).toUpperCase()}</span>
                            <div className="grow">
                              <div className="name">{c.company || c.name}</div>
                              <div className="sub">
                                {c.name} · {c.email}
                                {c.teamSize ? ` · ${c.teamSize} people` : ""}
                              </div>
                            </div>
                            <button className="primary" onClick={() => setApproving(c)}>Approve</button>
                          </div>
                        ))}
                        {pendingTotal > pending.length && (
                          <div className="panel-footer">
                            <Link to="/pending-requests">View all {pendingTotal} requests →</Link>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {approving && (
        <IssueLicenseModal
          customer={approving}
          initialTier={approving.teamSize ? TIER_FOR_TEAM_SIZE[approving.teamSize] : undefined}
          onCancel={() => setApproving(null)}
          onDone={() => {
            setApproving(null);
            loadStats();
            loadPending();
          }}
        />
      )}
    </div>
  );
}
