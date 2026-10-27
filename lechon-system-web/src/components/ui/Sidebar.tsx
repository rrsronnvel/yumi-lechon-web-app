import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Boxes,
  ClipboardList,
  FileSpreadsheet,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Truck,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export default function Sidebar() {
  const location = useLocation();
  const { user, isOwner, logout, apiEnv, apiBaseUrl, switchApiEnv } = useAuth();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const navigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Orders", href: "/orders", icon: ClipboardList },
    { name: "Logistics", href: "/logistics", icon: Truck },
    { name: "Manifest", href: "/manifest", icon: FileSpreadsheet },
    { name: "Inventory", href: "/inventory", icon: Boxes },
    ...(isOwner ? [{ name: "Settings", href: "/cms", icon: Settings }] : []),
  ];

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [location.pathname]);

  const getInitials = (name?: string) => {
    if (!name) return "YL";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const renderSidebarContent = (onNavigate?: () => void, showCloseButton = false) => (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3.5 border-b border-stone-800/80 p-5">
        <img
          src="/yumi-logo.png"
          alt="Yumi's Lechon Logo"
          className="h-11 w-11 shrink-0 rounded-full object-cover shadow-md ring-2 ring-amber-400/80"
        />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-extrabold leading-tight tracking-wider text-amber-400 uppercase">
            YUMI&apos;S LECHON
          </h1>
          <p className="mt-0.5 truncate text-[11px] font-medium text-stone-400">
            Management System
          </p>
        </div>
        {showCloseButton && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Close navigation menu"
            onClick={() => setIsMobileNavOpen(false)}
            className="shrink-0 text-stone-400 hover:bg-stone-900 hover:text-white"
          >
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3.5" aria-label="Primary navigation">
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
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm transition-colors ${
                isActive
                  ? "border-l-4 border-amber-400 bg-amber-500/15 font-semibold text-amber-400 shadow-2xs"
                  : "font-medium text-stone-400 hover:bg-stone-900 hover:text-stone-100"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-stone-800/80 bg-stone-950/40 px-3.5 py-2.5">
        <div className="mb-1.5 flex items-center justify-between text-[10px] font-bold tracking-wider text-stone-400 uppercase">
          <span>Target API</span>
          <span
            className="max-w-[110px] truncate font-mono text-[9px] text-amber-400/80"
            title={apiBaseUrl}
          >
            {apiEnv === "cloud" ? "Cloud" : "localhost:5199"}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => switchApiEnv("cloud")}
            aria-pressed={apiEnv === "cloud"}
            className={`flex cursor-pointer items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-[11px] font-semibold transition-all ${
              apiEnv === "cloud"
                ? "border-amber-500/60 bg-amber-500/20 text-amber-300 shadow-2xs"
                : "border-stone-800 bg-stone-900/60 text-stone-400 hover:border-stone-700 hover:text-stone-200"
            }`}
          >
            <span>☁️ Live Cloud</span>
            {apiEnv === "cloud" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />}
          </button>
          <button
            type="button"
            onClick={() => switchApiEnv("local")}
            aria-pressed={apiEnv === "local"}
            className={`flex cursor-pointer items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-[11px] font-semibold transition-all ${
              apiEnv === "local"
                ? "border-amber-500/60 bg-amber-500/20 text-amber-300 shadow-2xs"
                : "border-stone-800 bg-stone-900/60 text-stone-400 hover:border-stone-700 hover:text-stone-200"
            }`}
          >
            <span>💻 Local (5199)</span>
            {apiEnv === "local" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />}
          </button>
        </div>
      </div>

      {user && (
        <div className="border-t border-stone-800/80 bg-stone-950/80 p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-stone-700/80 bg-stone-900 text-xs font-bold text-amber-400 shadow-inner">
              {getInitials(user.fullName)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-stone-100" title={user.fullName}>
                {user.fullName}
              </p>
              <div className="mt-1">
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold shadow-2xs ${
                    user.role === "Owner"
                      ? "border-amber-500/40 bg-amber-500/15 text-amber-300"
                      : "border-stone-700 bg-stone-800 text-stone-200"
                  }`}
                >
                  {user.role === "Owner" ? "👑 Owner" : "🧑‍💼 Cashier"}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-stone-800 px-3 py-2 text-xs font-medium text-stone-400 transition-colors hover:border-rose-900/50 hover:bg-rose-950/30 hover:text-rose-300"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>End Shift (Logout)</span>
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      <aside className="hidden h-screen w-64 shrink-0 select-none flex-col border-r border-stone-800/80 bg-[#181312] text-stone-100 lg:flex">
        {renderSidebarContent()}
      </aside>

      <header className="sticky top-0 z-40 flex h-14 w-full shrink-0 items-center justify-between border-b border-stone-800 bg-[#181312] px-4 text-white lg:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Open navigation menu"
            aria-expanded={isMobileNavOpen}
            onClick={() => setIsMobileNavOpen(true)}
            className="shrink-0 text-amber-400 hover:bg-stone-900 hover:text-amber-300"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <img
            src="/yumi-logo.png"
            alt="Yumi's Lechon Logo"
            className="h-8 w-8 shrink-0 rounded-full object-cover ring-2 ring-amber-400/80"
          />
          <span className="truncate text-sm font-bold tracking-wide text-stone-100">Yumi&apos;s Lechon</span>
        </div>

        <div className="ml-2 flex shrink-0 items-center gap-1.5 text-[10px]">
          {user && (
            <span className="rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-1 font-semibold text-amber-300">
              {user.role === "Owner" ? "👑 Owner" : "Cashier"}
            </span>
          )}
          <span
            className="flex items-center gap-1 rounded-full border border-stone-700 bg-stone-900 px-2 py-1 text-stone-300"
            title={`API: ${apiBaseUrl}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${apiEnv === "cloud" ? "bg-amber-400" : "bg-emerald-400"}`} />
            {apiEnv === "cloud" ? "Cloud" : "Local"}
          </span>
        </div>
      </header>

      {isMobileNavOpen && (
        <Sheet open onOpenChange={setIsMobileNavOpen}>
          <SheetContent
            side="left"
            showCloseButton={false}
            className="w-72! max-w-[85vw]! translate-x-0! gap-0 border-r border-stone-800 bg-[#181312] p-0 text-white opacity-100! transition-none! sm:max-w-none lg:hidden"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Navigation menu</SheetTitle>
              <SheetDescription>Navigate the Yumi&apos;s Lechon management system.</SheetDescription>
            </SheetHeader>
            {renderSidebarContent(() => setIsMobileNavOpen(false), true)}
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}
