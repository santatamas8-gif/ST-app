"use client";

import { useTheme } from "@/components/ThemeProvider";
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
    <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-8" style={{ backgroundColor: "var(--page-bg)" }}>
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-white sm:text-xl lg:text-2xl">Wellness</h1>
          <p className={`mt-1 ${isHighContrast ? "text-white/90" : "text-zinc-400"}`}>
            Submit once per day. All scales are 1 to 10{" "}
            <span className={isHighContrast ? "text-white/70" : "text-zinc-500"}>
              (1 = very poor, 10 = excellent)
            </span>
            .
          </p>
        </div>

        {hasSubmittedToday && (
          <div
            className={`rounded-xl border px-4 py-3 ${themeId === "neon" ? "neon-card-text border-emerald-500/40" : themeId === "matt" ? "matt-card-text border-white/20" : "border-emerald-800/50 bg-emerald-950/30"}`}
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
        <h2 className="text-lg font-semibold text-white">Your 7-day & 28-day averages</h2>
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
