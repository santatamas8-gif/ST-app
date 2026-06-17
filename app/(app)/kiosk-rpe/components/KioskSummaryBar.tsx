"use client";

import { useTheme } from "@/components/ThemeProvider";
import { NEON_CARD_STYLE, MATT_CARD_STYLE } from "@/lib/themes";

const CARD_RADIUS = "12px";

interface KioskSummaryBarProps {
  total: number;
  completed: number;
  missing: number;
}

export function KioskSummaryBar({ total, completed, missing }: KioskSummaryBarProps) {
  const { themeId } = useTheme();
  const isHighContrast = themeId === "neon" || themeId === "matt";

  const cardStyle =
    themeId === "neon"
      ? { ...NEON_CARD_STYLE, borderRadius: CARD_RADIUS }
      : themeId === "matt"
        ? { ...MATT_CARD_STYLE, borderRadius: CARD_RADIUS }
        : { backgroundColor: "var(--card-bg)", borderRadius: CARD_RADIUS };

  const labelClass = `text-xs font-medium uppercase tracking-wide ${isHighContrast ? "text-white/70" : "text-zinc-500"}`;

  return (
    <section
      className={`rounded-xl border border-zinc-800/90 p-4 ${themeId === "neon" ? "neon-card-text" : themeId === "matt" ? "matt-card-text" : ""}`}
      style={cardStyle}
      aria-label="Submission summary"
    >
      <div className="grid grid-cols-3 gap-3 text-center sm:gap-6">
        <div>
          <p className={labelClass}>Total players</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-white">{total}</p>
        </div>
        <div>
          <p className={labelClass}>Completed</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-400">{completed}</p>
        </div>
        <div>
          <p className={labelClass}>Missing</p>
          <p className={`mt-1 text-2xl font-bold tabular-nums ${isHighContrast ? "text-amber-300" : "text-zinc-400"}`}>
            {missing}
          </p>
        </div>
      </div>
    </section>
  );
}
