"use client";

import Link from "next/link";
import { BarChart2, CalendarDays, GitCompareArrows } from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import type { TeamTrendsView } from "@/lib/rpe/teamTrendsView";

type TeamTrendsTab = {
  value: TeamTrendsView;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

const TEAM_TRENDS_TABS: TeamTrendsTab[] = [
  { value: "load", label: "Load Trend", icon: BarChart2 },
  { value: "matchday", label: "Matchday Analysis", icon: CalendarDays },
  { value: "weeks", label: "Compare Weeks", icon: GitCompareArrows },
];

export function TeamTrendsTabs({ activeView }: { activeView: TeamTrendsView }) {
  return (
    <nav aria-label="Team trends analyses" className="overflow-x-auto" role="tablist">
      <div className="flex min-w-max gap-2 sm:min-w-0 sm:flex-wrap">
        {TEAM_TRENDS_TABS.map(({ value, label, icon: Icon }) => {
          const isActive = activeView === value;
          return (
            <Link
              key={value}
              href={`/rpe?view=team&analysis=${value}`}
              role="tab"
              aria-selected={isActive}
              aria-current={isActive ? "page" : undefined}
              className={`inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 ${
                isActive
                  ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
                  : "border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-800/70 hover:text-zinc-200"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <span>{label}</span>
              {isActive && <span className="sr-only">current analysis</span>}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
