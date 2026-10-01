import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/LoginPage";
import { VerifyPage } from "./pages/VerifyPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DownloadsPage } from "./pages/DownloadsPage";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/login/verify" element={<VerifyPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/downloads" element={<DownloadsPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
