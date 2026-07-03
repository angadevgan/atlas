"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Database, Boxes, PlayCircle, Activity, BarChart3 } from "lucide-react";
import clsx from "clsx";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/datasets", label: "Datasets", icon: Database },
  { href: "/models", label: "Models", icon: Boxes },
  { href: "/predict", label: "Playground", icon: PlayCircle },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 bg-sidebar text-white/90 min-h-screen flex flex-col">
      <div className="px-5 py-6">
        <div className="flex items-center gap-2 font-display font-semibold text-lg tracking-tight">
          <span className="w-2 h-2 rounded-sm bg-accent inline-block" />
          Atlas
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition",
                active ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white/90"
              )}
            >
              <Icon size={16} strokeWidth={1.75} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-5 py-4 text-xs text-white/40 font-mono">v0.1.0</div>
    </aside>
  );
}
