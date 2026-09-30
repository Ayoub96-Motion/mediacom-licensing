import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function Layout() {
  const { admin, logout } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1>MediaCom Licensing</h1>
        <nav>
          <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
            Overview
          </NavLink>
          <NavLink to="/customers" className={({ isActive }) => (isActive ? "active" : "")}>
            Customers
          </NavLink>
          <NavLink to="/licenses" className={({ isActive }) => (isActive ? "active" : "")}>
            Licenses
          </NavLink>
          <NavLink to="/activity" className={({ isActive }) => (isActive ? "active" : "")}>
            Activity
          </NavLink>
        </nav>
        <div>
          {admin && <div className="admin-email">{admin.email}</div>}
          <button className="logout" onClick={logout}>Log out</button>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
