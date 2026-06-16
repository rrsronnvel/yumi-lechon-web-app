import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Utensils, ClipboardList, Truck } from "lucide-react";

export default function Sidebar() {
  const location = useLocation();

  const navigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Orders", href: "/orders", icon: ClipboardList },
    { name: "Kitchen", href: "/kitchen", icon: Utensils },
    { name: "Logistics", href: "/logistics", icon: Truck },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-100 h-screen flex flex-col border-r border-slate-800">
      <div className="p-6 border-b border-slate-800">
        <h1 className="text-lg font-bold tracking-wider text-amber-500 uppercase">
          Yumi's Lechon
        </h1>
        <p className="text-xs text-slate-400 mt-1">Management System</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              to={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-amber-600 text-white shadow-sm"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}