import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import LoginPage from "./pages/LoginPage";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/auth/ProtectedRoute";

const RootLayout = lazy(() => import("./components/ui/RootLayout"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const OrdersPage = lazy(() => import("./pages/OrdersPage"));
const KitchenPage = lazy(() => import("./pages/KitchenPage"));
const LogisticsPage = lazy(() => import("./pages/LogisticsPage"));
const InventoryPage = lazy(() => import("./pages/InventoryPage"));
const ManifestPage = lazy(() => import("./pages/ManifestPage"));
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const DailySheetsPage = lazy(() => import("./pages/DailySheetsPage"));
const CmsPage = lazy(() => import("./pages/CmsPage"));
const QrSignPage = lazy(() => import("./pages/QrSignPage"));
const ExpensesPage = lazy(() => import("./pages/ExpensesPage"));

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={null}>
          <Routes>
            {/* Public Authentication and QR Signature Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/qr-settle/:token" element={<QrSignPage />} />

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

              <Route
                path="expenses"
                element={
                  <ProtectedRoute allowedRoles={["Owner", "Accountant"]}>
                    <ExpensesPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="reports"
                element={
                  <ProtectedRoute allowedRoles={["Owner"]}>
                    <ReportsPage />
                  </ProtectedRoute>
                }
              />

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
        </Suspense>

        {/* 🔌 Global Toast Notifications */}
        <Toaster position="top-right" closeButton richColors />
      </BrowserRouter>
    </AuthProvider>
  );
}
