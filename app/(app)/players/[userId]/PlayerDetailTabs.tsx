"use client";

import { useState } from "react";
import { HeartPulse, Activity } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { PlayerWellnessTrend } from "./PlayerWellnessTrend";
import { PlayerLoadBreakdown } from "./PlayerLoadBreakdown";
import type { WellnessRow } from "@/lib/types";
import type { SessionRow } from "@/lib/types";

type TabId = "wellness" | "rpe";

interface PlayerDetailTabsProps {
  wellness: WellnessRow[];
  dates: string[];
  loadByDate: Record<string, number>;
  sessions: SessionRow[];
  showRpeTab: boolean;
}

export function PlayerDetailTabs({
  wellness,
  dates,
  loadByDate,
  sessions,
  showRpeTab,
}: PlayerDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("wellness");
  const { themeId } = useTheme();
  const isHighContrast = themeId === "neon" || themeId === "matt";

  if (!showRpeTab) {
    return (
      <PlayerWellnessTrend wellness={wellness} dates={dates} loadByDate={loadByDate} />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-center sm:justify-start border-b border-zinc-700/80 pb-4">
        <div
          className="inline-flex rounded-[14px] border p-0.5 h-10"
          style={{
            backgroundColor: isHighContrast ? "rgba(255,255,255,0.06)" : "rgba(15,23,32,0.9)",
            borderColor: isHighContrast ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.08)",
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab("wellness")}
            className={`flex items-center justify-center gap-2 min-w-[100px] flex-1 rounded-[10px] px-3 text-sm font-medium transition-all duration-200 ${
              activeTab === "wellness"
                ? "bg-emerald-700/90 text-white"
                : "bg-transparent text-gray-400 hover:text-gray-300 hover:bg-white/5 active:bg-white/10"
            }`}
          >
            <HeartPulse className="h-4 w-4 shrink-0" aria-hidden />
            Wellness
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("rpe")}
            className={`flex items-center justify-center gap-2 min-w-[100px] flex-1 rounded-[10px] px-3 text-sm font-medium transition-all duration-200 ${
              activeTab === "rpe"
                ? "bg-emerald-700/90 text-white"
                : "bg-transparent text-gray-400 hover:text-gray-300 hover:bg-white/5 active:bg-white/10"
            }`}
          >
            <Activity className="h-4 w-4 shrink-0" aria-hidden />
            RPE
          </button>
        </div>
      </div>
      {activeTab === "wellness" && (
        <PlayerWellnessTrend wellness={wellness} dates={dates} loadByDate={loadByDate} />
      )}
      {activeTab === "rpe" && <PlayerLoadBreakdown sessions={sessions} />}
    </div>
  );
}
