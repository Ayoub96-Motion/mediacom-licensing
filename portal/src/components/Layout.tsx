import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function Layout() {
  const { customer, logout, logoutAll } = useAuth();
  const [confirmingLogoutAll, setConfirmingLogoutAll] = useState(false);

  async function handleLogoutAll() {
    if (!confirmingLogoutAll) {
      setConfirmingLogoutAll(true);
      return;
    }
    await logoutAll();
  }

  return (
    <div className="portal-shell">
      <header className="portal-header">
        <div className="portal-brand">MediaCom Portal</div>
        <nav>
          <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
            My Licenses
          </NavLink>
          <NavLink to="/downloads" className={({ isActive }) => (isActive ? "active" : "")}>
            Downloads
          </NavLink>
        </nav>
        <div className="portal-account">
          {customer && <span className="muted">{customer.email}</span>}
          <button className="link" onClick={logout}>Log out</button>
          <button className="link" onClick={handleLogoutAll} onBlur={() => setConfirmingLogoutAll(false)}>
            {confirmingLogoutAll ? "Click again to confirm" : "Log out all devices"}
          </button>
        </div>
      </header>
      <main className="portal-content">
        <Outlet />
      </main>
    </div>
  );
}
