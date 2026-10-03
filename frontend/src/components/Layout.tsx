import type { ReactNode } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { ActivityIcon, DashboardIcon, KeyIcon, PackageIcon, UserPlusIcon, UsersIcon } from "./Icons";
import { ProfileMenu } from "./ProfileMenu";

function NavItem({ to, end, icon, label }: { to: string; end?: boolean; icon: ReactNode; label: string }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => (isActive ? "active" : "")}>
      {icon}
      {label}
    </NavLink>
  );
}

export function Layout() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link to="/" className="sidebar-brand">
          <span className="sidebar-logo"><KeyIcon size={18} /></span>
          <span className="sidebar-wordmark">
            MediaCom
            <span>Licensing</span>
          </span>
        </Link>

        <div className="sidebar-section">Overview</div>
        <nav>
          <NavItem to="/" end icon={<DashboardIcon />} label="Dashboard" />
        </nav>

        <div className="sidebar-section">Manage</div>
        <nav>
          <NavItem to="/customers" icon={<UsersIcon />} label="Customers" />
          <NavItem to="/pending-requests" icon={<UserPlusIcon />} label="Pending Requests" />
          <NavItem to="/licenses" icon={<KeyIcon />} label="Licenses" />
          <NavItem to="/releases" icon={<PackageIcon />} label="Releases" />
        </nav>

        <div className="sidebar-section">System</div>
        <nav>
          <NavItem to="/activity" icon={<ActivityIcon />} label="Audit Log" />
        </nav>

        <ProfileMenu />
      </aside>
      <main className="content">
        <div className="content-inner">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
