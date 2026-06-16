import { BrowserRouter, Routes, Route } from "react-router-dom";
import RootLayout from "./components/ui/RootLayout";
import DashboardPage from "./pages/DashboardPage";
import OrdersPage from "./pages/OrdersPage";
import KitchenPage from "./pages/KitchenPage";
import LogisticsPage from "./pages/LogisticsPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Everything inside this group inherits the Sidebar wrapper framework */}
        <Route path="/" element={<RootLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="kitchen" element={<KitchenPage />} />
          <Route path="logistics" element={<LogisticsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}