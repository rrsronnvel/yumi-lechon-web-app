import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import RootLayout from "./components/ui/RootLayout";
import DashboardPage from "./pages/DashboardPage";
import OrdersPage from "./pages/OrdersPage";
import KitchenPage from "./pages/KitchenPage";
import LogisticsPage from "./pages/LogisticsPage";
import { Toaster } from "@/components/ui/sonner";
import InventoryPage from "./pages/InventoryPage";
import ManifestPage from "./pages/ManifestPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import DailySheetsPage from "./pages/DailySheetsPage";
import CmsPage from "./pages/CmsPage";
import LoginPage from "./pages/LoginPage";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/auth/ProtectedRoute";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Authentication Route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Application Shell */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <RootLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="kitchen" element={<KitchenPage />} />
            <Route path="logistics" element={<LogisticsPage />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="manifest" element={<ManifestPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />

            {/* Owner-Only Routes */}
            <Route
              path="cms"
              element={
                <ProtectedRoute allowedRoles={["Owner"]}>
                  <CmsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="settings"
              element={
                <ProtectedRoute allowedRoles={["Owner"]}>
                  <CmsPage />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* Standalone Views */}
          <Route
            path="/daily-sheets"
            element={
              <ProtectedRoute>
                <DailySheetsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute allowedRoles={["Owner"]}>
                <CmsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/cms"
            element={
              <ProtectedRoute allowedRoles={["Owner"]}>
                <CmsPage />
              </ProtectedRoute>
            }
          />

          {/* Catch-all fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        {/* 🔌 Global Toast Notifications */}
        <Toaster position="top-right" closeButton richColors />
      </BrowserRouter>
    </AuthProvider>
  );
}
