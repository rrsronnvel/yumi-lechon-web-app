import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ClipboardList,
  Truck,
  FileSpreadsheet,
  Boxes,
  Settings,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function Sidebar() {
  const location = useLocation();
  const { user, isOwner, logout, apiEnv, apiBaseUrl, switchApiEnv } = useAuth();

  const navigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Orders", href: "/orders", icon: ClipboardList },
    { name: "Logistics", href: "/logistics", icon: Truck },
    { name: "Manifest", href: "/manifest", icon: FileSpreadsheet },
    { name: "Inventory", href: "/inventory", icon: Boxes },
    ...(isOwner ? [{ name: "Settings", href: "/cms", icon: Settings }] : []),
  ];

  const getInitials = (name?: string) => {
    if (!name) return "YL";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <aside className="w-64 bg-[#181312] text-stone-100 h-screen flex flex-col border-r border-stone-800/80 shrink-0 select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-stone-800/80 flex items-center gap-3.5">
        <img
          src="/yumi-logo.png"
          alt="Yumi's Lechon Logo"
          className="w-11 h-11 rounded-full object-cover ring-2 ring-amber-400/80 shadow-md shrink-0"
        />
        <div className="min-w-0">
          <h1 className="text-base font-extrabold tracking-wider text-amber-400 uppercase leading-tight truncate">
            YUMI&apos;S LECHON
          </h1>
          <p className="text-[11px] text-stone-400 font-medium mt-0.5 truncate">
            Management System
          </p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-3.5 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive =
            item.href === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(item.href) ||
                (item.href === "/cms" && location.pathname.startsWith("/settings"));
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              to={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-amber-500/15 text-amber-400 border-l-4 border-amber-400 font-semibold shadow-2xs"
                  : "text-stone-400 hover:bg-stone-900 hover:text-stone-100 font-medium"
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Target API Environment Switcher */}
      <div className="px-3.5 py-2.5 border-t border-stone-800/80 bg-stone-950/40">
        <div className="flex items-center justify-between mb-1.5 text-[10px] font-bold text-stone-400 tracking-wider uppercase">
          <span>Target API</span>
          <span className="text-[9px] font-mono text-amber-400/80 truncate max-w-[110px]" title={apiBaseUrl}>
            {apiEnv === "cloud" ? "Cloud" : "localhost:5199"}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => switchApiEnv("cloud")}
            aria-pressed={apiEnv === "cloud"}
            className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
              apiEnv === "cloud"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/60 shadow-2xs"
                : "bg-stone-900/60 text-stone-400 hover:text-stone-200 border border-stone-800 hover:border-stone-700"
            }`}
          >
            <span>☁️ Live Cloud</span>
            {apiEnv === "cloud" && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
          </button>
          <button
            type="button"
            onClick={() => switchApiEnv("local")}
            aria-pressed={apiEnv === "local"}
            className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
              apiEnv === "local"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/60 shadow-2xs"
                : "bg-stone-900/60 text-stone-400 hover:text-stone-200 border border-stone-800 hover:border-stone-700"
            }`}
          >
            <span>💻 Local (5199)</span>
            {apiEnv === "local" && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
          </button>
        </div>
      </div>

      {/* Bottom User HUD Card */}
      {user && (
        <div className="p-4 border-t border-stone-800/80 bg-stone-950/80">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-stone-900 border border-stone-700/80 flex items-center justify-center font-bold text-xs text-amber-400 shrink-0 shadow-inner">
              {getInitials(user.fullName)}
            </div>
            <div className="flex-1 min-w-0">
              <p
                className="text-xs font-semibold text-stone-100 truncate"
                title={user.fullName}
              >
                {user.fullName}
              </p>
              <div className="mt-1">
                {user.role === "Owner" ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-2xs">
                    👑 Owner
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-stone-800 text-stone-200 border border-stone-700 shadow-2xs">
                    🧑‍💼 Cashier
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-stone-400 hover:text-rose-300 hover:bg-rose-950/30 border border-stone-800 hover:border-rose-900/50 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>End Shift (Logout)</span>
          </button>
        </div>
      )}
    </aside>
  );
}