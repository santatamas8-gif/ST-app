"use client";

import { useTheme } from "@/components/ThemeProvider";
import { TrendingUp } from "lucide-react";
import { NEON_CARD_STYLE, MATT_CARD_STYLE } from "@/lib/themes";
import { DailyWellnessForm } from "@/components/DailyWellnessForm";
import { PlayerWellnessTrend } from "../../players/[userId]/PlayerWellnessTrend";
import type { WellnessRow } from "@/lib/types";

const CARD_RADIUS = "12px";

type WellnessPlayerContentProps = {
  hasSubmittedToday: boolean;
  list: WellnessRow[];
  dates: string[];
  loadByDate: Record<string, number>;
};

export function WellnessPlayerContent({
  hasSubmittedToday,
  list,
  dates,
  loadByDate,
}: WellnessPlayerContentProps) {
  const { themeId } = useTheme();
  const isHighContrast = themeId === "neon" || themeId === "matt";

  return (
    <div className="min-h-screen min-w-0 -mx-4 overflow-x-hidden px-3 py-8 sm:mx-0 sm:px-6 lg:px-8" style={{ backgroundColor: "var(--page-bg)" }}>
      <div className="mx-auto min-w-0 max-w-2xl space-y-6">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-white sm:text-xl lg:text-2xl">Wellness</h1>
          <p className={`mt-1 text-xs sm:text-sm ${isHighContrast ? "text-white/90" : "text-zinc-400"}`}>
            <span className="sm:hidden">Submit once per day. Scales 1–10 (1 = poor, 10 = excellent).</span>
            <span className="hidden sm:inline">
              Submit once per day. All scales are 1 to 10{" "}
              <span className={isHighContrast ? "text-white/70" : "text-zinc-500"}>
                (1 = very poor, 10 = excellent)
              </span>
              .
            </span>
          </p>
        </div>

        {/* On mobile (player only): do not show this card – DailyWellnessForm shows "Already submitted today" below to avoid duplicate message */}
        {hasSubmittedToday && (
          <div
            className={`hidden rounded-xl border px-4 py-3 md:block ${themeId === "neon" ? "neon-card-text border-emerald-500/40" : themeId === "matt" ? "matt-card-text border-white/20" : "border-emerald-800/50 bg-emerald-950/30"}`}
            style={
              themeId === "neon"
                ? { ...NEON_CARD_STYLE, borderRadius: CARD_RADIUS }
                : themeId === "matt"
                  ? { ...MATT_CARD_STYLE, borderRadius: CARD_RADIUS }
                  : { borderRadius: CARD_RADIUS }
            }
          >
            <p className="flex items-center gap-2 font-medium text-emerald-400">
              <span>✔</span> You&apos;ve already submitted today
            </p>
          </div>
        )}

        <DailyWellnessForm hasSubmittedToday={hasSubmittedToday} />
      </div>

      {/* Averages section: full width like staff view so chart cards are not narrow */}
      <div className="mx-auto w-full space-y-6 pt-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold" style={{ color: "var(--foreground)" }}>
          <TrendingUp className="h-5 w-5 shrink-0 text-white" aria-hidden />
          Your trends & averages
        </h2>
        {list.length === 0 ? (
          <p
            className={`mx-auto max-w-2xl rounded-xl border p-6 ${themeId === "neon" ? "neon-card-text border-white/20 text-white/90" : themeId === "matt" ? "matt-card-text border-white/20 text-white/90" : "border-zinc-700 bg-zinc-900/50 text-zinc-400"}`}
            style={{
              borderRadius: CARD_RADIUS,
              ...(themeId === "neon" ? NEON_CARD_STYLE : themeId === "matt" ? MATT_CARD_STYLE : {}),
            }}
          >
            No wellness entries yet. Submit your first entry above to see your trends here.
          </p>
        ) : (
          <PlayerWellnessTrend wellness={list} dates={dates} loadByDate={loadByDate} />
        )}
      </div>
    </div>
  );
}
