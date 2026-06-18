"use client";

import Link from "next/link";
import { BarChart2, ClipboardList, LayoutDashboard, UsersRound } from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import type { StaffRpeView } from "@/lib/rpe/staffRpeView";

type TabConfig = {
  value: StaffRpeView;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

const TABS: TabConfig[] = [
  { value: "overview", label: "Overview", icon: LayoutDashboard },
  { value: "team", label: "Team Trends", icon: BarChart2 },
  { value: "players", label: "Player Analysis", icon: UsersRound },
  { value: "kiosk", label: "Kiosk Sessions", icon: ClipboardList },
];

export function StaffRpeTabs({ activeView }: { activeView: StaffRpeView }) {
  return (
    <nav
      aria-label="RPE workspace sections"
      className="overflow-x-auto border-b border-zinc-800 pb-2"
      role="tablist"
    >
      <div className="flex min-w-max gap-2 sm:min-w-0 sm:flex-wrap">
        {TABS.map(({ value, label, icon: Icon }) => {
          const isActive = activeView === value;
          const href = value === "overview" ? "/rpe?view=overview" : `/rpe?view=${value}`;
          return (
            <Link
              key={value}
              href={href}
              role="tab"
              aria-selected={isActive}
              aria-current={isActive ? "page" : undefined}
              className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 sm:px-4 ${
                isActive
                  ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300 shadow-sm shadow-emerald-950/20"
                  : "border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-800/70 hover:text-zinc-200"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <span>{label}</span>
              {isActive && <span className="sr-only">current section</span>}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
