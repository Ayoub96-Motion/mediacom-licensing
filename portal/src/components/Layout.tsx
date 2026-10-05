import { NavLink, Outlet } from "react-router-dom";
import { ProfileDropdown } from "./ProfileDropdown";

export function Layout() {
  return (
    <div className="portal-shell">
      <header className="portal-header">
        <div className="portal-brand">
          <span className="portal-brand-badge">M</span>
          MediaCom <span className="portal-brand-sub">Portal</span>
        </div>
        <nav className="portal-nav">
          <NavLink to="/" end className={({ isActive }) => (isActive ? "nav-pill active" : "nav-pill")}>
            Dashboard
          </NavLink>
        </nav>
        <ProfileDropdown />
      </header>
      <main className="portal-content">
        <Outlet />
      </main>
    </div>
  );
}
