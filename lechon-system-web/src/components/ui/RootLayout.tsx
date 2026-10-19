import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

export default function RootLayout() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#FAF6F4] text-stone-900">
      {/* Locked Left-Hand Sidebar */}
      <Sidebar />

      {/* Main Content Workspace viewport */}
      <main className="flex-1 overflow-y-auto bg-[#FAF6F4]">
        <Outlet />
      </main>
    </div>
  );
}