import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

export default function RootLayout() {
  return (
    <div className="flex h-dvh w-full max-w-full flex-col overflow-hidden bg-[#FAF6F4] text-stone-900 lg:flex-row">
      {/* Desktop sidebar and mobile navigation header */}
      <Sidebar />

      {/* Fluid content workspace */}
      <main className="min-h-0 min-w-0 w-full flex-1 overflow-x-hidden overflow-y-auto bg-[#FAF6F4] p-3 sm:p-4 md:p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  );
}
