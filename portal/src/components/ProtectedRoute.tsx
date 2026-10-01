import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function ProtectedRoute() {
  const { customer, loading } = useAuth();
  if (loading) return <div className="page-loading">Loading…</div>;
  if (!customer) return <Navigate to="/login" replace />;
  return <Outlet />;
}
