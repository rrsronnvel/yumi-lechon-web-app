import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

export default function RootLayout() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-900">
      {/* Locked Left-Hand Sidebar */}
      <Sidebar />

      {/* Main Content Workspace viewport */}
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-xs border border-slate-200/60 p-6 min-h-[calc(100vh-4rem)]">
          <Outlet /> {/* Dynamic pages pop up right inside here! */}
        </div>
      </main>
    </div>
  );
}