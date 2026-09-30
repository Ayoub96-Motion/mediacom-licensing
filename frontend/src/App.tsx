import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/LoginPage";
import { OverviewPage } from "./pages/OverviewPage";
import { CustomersPage } from "./pages/CustomersPage";
import { CustomerDetailPage } from "./pages/CustomerDetailPage";
import { LicensesPage } from "./pages/LicensesPage";
import { LicenseDetailPage } from "./pages/LicenseDetailPage";
import { ActivityPage } from "./pages/ActivityPage";
import { ReleasesPage } from "./pages/ReleasesPage";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<OverviewPage />} />
              <Route path="/customers" element={<CustomersPage />} />
              <Route path="/customers/:id" element={<CustomerDetailPage />} />
              <Route path="/licenses" element={<LicensesPage />} />
              <Route path="/licenses/:id" element={<LicenseDetailPage />} />
              <Route path="/releases" element={<ReleasesPage />} />
              <Route path="/activity" element={<ActivityPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
